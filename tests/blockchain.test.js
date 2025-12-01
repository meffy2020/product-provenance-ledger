const request = require('supertest'); // API 요청을 보내기 위한 supertest 라이브러리
const app = require('../app'); // 테스트할 Express 애플리케이션을 가져옵니다.
const axios = require('axios'); // axios를 모킹하기 위해 가져옵니다.
const Blockchain = require('../blockchain/blockchain'); // Blockchain 클래스를 가져옵니다.

// axios 모듈을 모킹합니다. 실제 네트워크 요청을 보내지 않고, 우리가 정의한 가짜 응답을 반환하게 됩니다.
jest.mock('axios');

// 'Blockchain API' 테스트 스위트(테스트 묶음)를 정의합니다.
describe('Blockchain API', () => {

    let blockchain;

    // 각 테스트 케이스('it')가 실행되기 전에 항상 실행되는 코드입니다.
    beforeEach(() => {
        // Express 앱에 저장된 블록체인 인스턴스를 가져옵니다.
        blockchain = app.get('blockchain');
        // 각 테스트가 독립적으로 실행될 수 있도록, 테스트마다 블록체인 상태를 초기화합니다.
        blockchain.chain = [];
        blockchain.pendingTransactions = [];
        blockchain.networkNodes = [];
        blockchain.createNewBlock(100, '0', '0'); // 제네시스 블록을 다시 생성합니다.
        // 모든 모의(mock) 함수들의 호출 기록을 초기화합니다.
        jest.clearAllMocks();
    });

    // --- 기본 API 테스트 ---
    describe('GET /blockchain', () => {
        it('블록체인 전체를 반환해야 합니다.', async () => {
            const res = await request(app).get('/blockchain');
            expect(res.statusCode).toEqual(200); // HTTP 상태 코드가 200 OK인지 확인
            expect(res.body.chain).toHaveLength(1); // 체인의 길이가 1 (제네시스 블록만 있음)인지 확인
            expect(res.body.chain[0].nonce).toBe(100); // 제네시스 블록의 nonce 값이 100인지 확인
        });
    });

    // --- 거래, 채굴, 이력 조회 통합 테스트 ---
    describe('Transaction, Mining, and History Flow', () => {
        it('거래 생성 -> 채굴 -> 이력 조회 흐름이 정상 동작해야 합니다.', async () => {
            const productId = 'sneakers-123';
    
            // 1단계: 새로운 거래를 생성합니다.
            await request(app)
                .post('/transactions')
                .send({ sender: 'Alice', recipient: 'Bob', productId: productId })
                .expect(201);
            
            expect(blockchain.pendingTransactions).toHaveLength(1);
    
            // 2단계: 새로운 블록을 채굴합니다.
            await request(app)
                .post('/mine')
                .send({ minerAddress: 'Charlie' })
                .expect(200);
            
            expect(blockchain.chain).toHaveLength(2);
            expect(blockchain.pendingTransactions).toHaveLength(0);
    
            // 3단계: 채굴된 거래의 상품 이력을 조회합니다.
            const historyRes = await request(app).get(`/histories/${productId}`).expect(200);
            
            expect(historyRes.body.history).toHaveLength(1);
            expect(historyRes.body.history[0].sender).toBe('Alice');
        });
    });
    
    // --- 각 API 실패 시나리오 테스트 ---
    describe('API Failure Cases', () => {
        it('POST /transactions: 필수 필드 누락 시 400 에러를 반환해야 합니다.', async () => {
            await request(app)
                .post('/transactions')
                .send({ sender: 'Alice', recipient: 'Bob' }) // productId 누락
                .expect(400);
        });

        it('POST /mine: 채굴자 주소 누락 시 400 에러를 반환해야 합니다.', async () => {
            await request(app)
                .post('/mine')
                .send({}) // minerAddress 누락
                .expect(400);
        });

        it('GET /histories/:productId: 존재하지 않는 상품 조회 시 404 에러를 반환해야 합니다.', async () => {
            await request(app).get('/histories/non-existent-product').expect(404);
        });
    });

    // --- Nodes API 테스트 ---
    describe('Nodes API', () => {
        it('POST /register-node: 새로운 노드를 성공적으로 등록해야 합니다.', async () => {
            const res = await request(app)
                .post('/nodes/register-node')
                .send({ newNodeUrl: 'http://localhost:3001' });

            expect(res.statusCode).toEqual(200);
            expect(blockchain.networkNodes).toContain('http://localhost:3001');
        });

        it('GET /consensus: 더 긴 유효 체인으로 교체되어야 합니다.', async () => {
            // 1. 다른 노드가 더 긴 체인을 가지고 있는 상황을 시뮬레이션합니다.
            const anotherNodeUrl = 'http://localhost:3002';
            blockchain.networkNodes.push(anotherNodeUrl);

            const longerChain = JSON.parse(JSON.stringify(blockchain.chain)); // Deep copy
            // 새 블록을 추가하여 더 긴 체인을 만듭니다.
            const lastBlock = blockchain.getLastBlock();
            const nonce = 12345;
            const hash = blockchain.hashBlock(lastBlock.hash, { transactions: [], index: 2 }, nonce);
            longerChain.push({ index: 2, timestamp: Date.now(), transactions: [], nonce, hash, previousBlockHash: lastBlock.hash });

            // 2. axios.get이 호출되면, 위에서 만든 더 긴 체인을 반환하도록 모의(mock) 구현합니다.
            axios.get.mockResolvedValue({
                data: {
                    chain: longerChain,
                    pendingTransactions: []
                }
            });
            // chainIsValid가 true를 반환하도록 모의 구현합니다.
            jest.spyOn(blockchain, 'chainIsValid').mockReturnValue(true);

            // 3. /consensus API를 호출합니다.
            const res = await request(app).get('/nodes/consensus');
            
            // 4. API 호출 결과를 검증합니다.
            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toContain('체인을 교체했습니다.');
            expect(blockchain.chain.length).toBe(2); // 현재 노드의 체인이 2로 늘어났는지 확인
        });
    });

    // --- Blockchain 클래스 단위 테스트 ---
    describe('Blockchain Class Methods (단위 테스트)', () => {
        let isolatedBlockchain;

        beforeEach(() => {
            // Express 앱의 블록체인 인스턴스와 별개로, 완전히 새로운 블록체인 인스턴스를 생성하여 테스트합니다.
            isolatedBlockchain = new Blockchain();
            isolatedBlockchain.chain = [];
            isolatedBlockchain.pendingTransactions = [];
            isolatedBlockchain.createNewBlock(100, '0', '0'); // 제네시스 블록 생성
        });

        it('체인 유효성 검증: 조작된 블록을 올바르게 감지해야 합니다.', async () => {
            // 1. 정상적인 첫 번째 블록(제네시스 블록 외)을 생성합니다.
            isolatedBlockchain.createNewTransaction('A', 'B', 'P1');
            const lastBlock = isolatedBlockchain.getLastBlock();
            const nonce = await isolatedBlockchain.proofOfWork(lastBlock.hash, { transactions: isolatedBlockchain.pendingTransactions, index: lastBlock.index + 1 });
            const hash = isolatedBlockchain.hashBlock(lastBlock.hash, { transactions: isolatedBlockchain.pendingTransactions, index: lastBlock.index + 1 }, nonce);
            isolatedBlockchain.createNewBlock(nonce, lastBlock.hash, hash); // Block 2 (valid)

            // 2. 현재 체인은 유효해야 합니다.
            expect(isolatedBlockchain.chainIsValid(isolatedBlockchain.chain)).toBe(true);

            // 3. --- 체인을 의도적으로 조작합니다. (Block 2의 이전 블록 해시를 변경) ---
            // 이 조작은 `chainIsValid`의 첫 번째 검증(currentBlock.previousBlockHash !== prevBlock.hash)에서 걸려야 합니다.
            isolatedBlockchain.chain[1].previousBlockHash = 'MALICIOUS_PREV_HASH'; // 이전 블록 해시 조작

            // 4. 조작된 체인은 유효하지 않아야 합니다.
            expect(isolatedBlockchain.chainIsValid(isolatedBlockchain.chain)).toBe(false);

            // --- 추가 테스트: 블록의 내용(트랜잭션)을 조작하여 유효성 검증을 확인 ---
            // 다시 체인 초기화 및 유효한 블록 생성 (동일한 인스턴스에서 진행)
            isolatedBlockchain = new Blockchain(); // 다시 초기화
            isolatedBlockchain.chain = [];
            isolatedBlockchain.pendingTransactions = [];
            isolatedBlockchain.createNewBlock(100, '0', '0'); // 제네시스 블록

            isolatedBlockchain.createNewTransaction('X', 'Y', 'P2');
            const lastBlock2 = isolatedBlockchain.getLastBlock();
            const nonce2 = await isolatedBlockchain.proofOfWork(lastBlock2.hash, { transactions: isolatedBlockchain.pendingTransactions, index: lastBlock2.index + 1 });
            const hash2 = isolatedBlockchain.hashBlock(lastBlock2.hash, { transactions: isolatedBlockchain.pendingTransactions, index: lastBlock2.index + 1 }, nonce2);
            isolatedBlockchain.createNewBlock(nonce2, lastBlock2.hash, hash2); // Block 2 (valid)

            expect(isolatedBlockchain.chainIsValid(isolatedBlockchain.chain)).toBe(true); // 여전히 유효

            // Block 2의 트랜잭션 내용을 조작합니다.
            isolatedBlockchain.chain[1].transactions[0].recipient = 'Z_RECIPIENT_TAMPERED';
            
            // 조작된 체인은 유효하지 않아야 합니다.
            expect(isolatedBlockchain.chainIsValid(isolatedBlockchain.chain)).toBe(false);
        });
    });
});