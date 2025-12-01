const request = require('supertest');
const app = require('../app');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

jest.mock('axios'); // axios 모듈을 모킹합니다.

describe('Transactions API', () => {
    let blockchain;
    let testTransactionId;
    let testBlockIndex;

    beforeEach(() => {
        blockchain = app.get('blockchain');
        blockchain.chain = [];
        blockchain.pendingTransactions = [];
        blockchain.networkNodes = [];
        blockchain.createNewBlock(100, '0', '0'); // Genesis Block
        jest.clearAllMocks();

        // 테스트를 위한 기본 트랜잭션 및 블록 생성
        blockchain.createNewTransaction('sender1', 'recipient1', 'productA');
        testTransactionId = blockchain.pendingTransactions[0].transactionId;
        let lastBlock = blockchain.getLastBlock();
        let previousBlockHash = lastBlock.hash;
        let currentBlockData = { transactions: [...blockchain.pendingTransactions], index: lastBlock.index + 1 };
        let nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData);
        let blockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);
        let newBlock = blockchain.createNewBlock(nonce, previousBlockHash, blockHash);
        testBlockIndex = newBlock.index;

        // 디버깅을 위해 체인 길이와 블록 인덱스 확인
        expect(blockchain.chain.length).toBe(2);
        expect(testBlockIndex).toBe(2); // Genesis block has index 1, so second block has index 2.

        // 보류 중인 트랜잭션 추가
        blockchain.createNewTransaction('sender2', 'recipient2', 'productB');
        blockchain.createNewTransaction('sender3', 'recipient3', 'productC');
    });

    // GET /transactions
    it('GET /transactions: 모든 처리 대기 중인 트랜잭션 목록을 반환해야 합니다.', async () => {
        const res = await request(app).get('/transactions');
        expect(res.statusCode).toEqual(200);
        expect(res.body.pendingTransactions).toHaveLength(2); // beforeEach에서 2개 추가
    });

    // POST /transactions
    it('POST /transactions: 새로운 트랜잭션을 생성하여 처리 대기 목록에 추가해야 합니다.', async () => {
        const initialPendingTxCount = blockchain.pendingTransactions.length;
        const res = await request(app)
            .post('/transactions')
            .send({ sender: 'newSender', recipient: 'newRecipient', productId: 'newProduct' });

        expect(res.statusCode).toEqual(201);
        expect(res.body.result).toBe('Success');
        expect(res.body.transaction).toBeDefined();
        expect(blockchain.pendingTransactions).toHaveLength(initialPendingTxCount + 1);
    });

    it('POST /transactions: 필수 필드 누락 시 400 에러를 반환해야 합니다.', async () => {
        const res = await request(app)
            .post('/transactions')
            .send({ sender: 'newSender', recipient: 'newRecipient' }); // productId 누락

        expect(res.statusCode).toEqual(400);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('필수 항목입니다.');
    });

    // POST /transactions/broadcast
    it('POST /transactions/broadcast: 새로운 트랜잭션을 생성하고 네트워크에 브로드캐스트해야 합니다.', async () => {
        axios.post.mockResolvedValue({ status: 200 }); // axios.post 모킹 (등록 노드 없으므로 호출 안 됨)
        axios.mockResolvedValue({ status: 200 }); // axios 기본 함수 모킹

        const initialPendingTxCount = blockchain.pendingTransactions.length;
        const res = await request(app)
            .post('/transactions/broadcast')
            .send({ sender: 'bSender', recipient: 'bRecipient', productId: 'bProduct' });

        expect(res.statusCode).toEqual(201);
        expect(res.body.result).toBe('Success');
        expect(res.body.transaction).toBeDefined();
        expect(blockchain.pendingTransactions).toHaveLength(initialPendingTxCount + 1); // 현재 노드에도 추가됨
    });

    it('POST /transactions/broadcast: 브로드캐스트 실패 시 500 에러를 반환해야 합니다.', async () => {
        blockchain.networkNodes.push('http://localhost:3005'); // 가상의 노드 추가
        axios.mockRejectedValue(new Error('Broadcast failed')); // axios 기본 함수 모킹 (실패)

        const res = await request(app)
            .post('/transactions/broadcast')
            .send({ sender: 'bSender', recipient: 'bRecipient', productId: 'bProduct' });

        expect(res.statusCode).toEqual(500);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('트랜잭션 브로드캐스트에 실패했습니다.');
    });

    // POST /transactions/pending/broadcast
    it('POST /transactions/pending/broadcast: 모든 처리 대기 중인 트랜잭션을 브로드캐스트해야 합니다.', async () => {
        blockchain.networkNodes.push('http://localhost:3006'); // 가상의 노드 추가
        axios.mockResolvedValue({ status: 200 });

        const initialPendingTxCount = blockchain.pendingTransactions.length; // 2개
        expect(initialPendingTxCount).toBe(2);

        const res = await request(app)
            .post('/transactions/pending/broadcast');

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.transactions).toHaveLength(initialPendingTxCount);
        expect(blockchain.pendingTransactions).toHaveLength(0); // 브로드캐스트 후 비워져야 함
    });

    it('POST /transactions/pending/broadcast: 브로드캐스트할 트랜잭션이 없으면 400 에러를 반환해야 합니다.', async () => {
        blockchain.pendingTransactions = []; // 비어있게 설정
        const res = await request(app)
            .post('/transactions/pending/broadcast');

        expect(res.statusCode).toEqual(400);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('트랜잭션이 없습니다.');
    });

    // GET /transactions/:transactionId
    it('GET /transactions/:transactionId: 특정 트랜잭션 ID로 상세 정보를 반환해야 합니다.', async () => {
        const res = await request(app).get(`/transactions/${testTransactionId}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.transaction.transactionId).toBe(testTransactionId);
        expect(res.body.block).toBeDefined();
    });

    it('GET /transactions/:transactionId: 존재하지 않는 트랜잭션 ID로 조회 시 404 에러를 반환해야 합니다.', async () => {
        const res = await request(app).get(`/transactions/${uuidv4().split('-').join('')}`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('찾을 수 없습니다.');
    });

    // GET /transactions/block/:blockIndex
    it('GET /transactions/block/:blockIndex: 특정 블록 인덱스로 트랜잭션 목록을 반환해야 합니다.', async () => {
        const res = await request(app).get(`/transactions/block/${testBlockIndex}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.blockTransactions).toHaveLength(1); // beforeEach에서 1개 트랜잭션으로 블록 생성
        expect(res.body.blockTransactions[0].productId).toBe('productA');
        expect(res.body.block.index).toBe(testBlockIndex);
    });

    it('GET /transactions/block/:blockIndex: 유효하지 않은 블록 인덱스로 조회 시 400 에러를 반환해야 합니다.', async () => {
        // 유효하지 않은 형식 (NaN)
        const res1 = await request(app).get('/transactions/block/abc');
        expect(res1.statusCode).toEqual(400);
        expect(res1.body.result).toBe('Fail');
        expect(res1.body.error).toContain('유효한 블록 인덱스를 입력하세요 (1 이상의 숫자).');

        // 유효하지 않은 값 (0 이하)
        const res2 = await request(app).get('/transactions/block/0');
        expect(res2.statusCode).toEqual(400);
        expect(res2.body.result).toBe('Fail');
        expect(res2.body.error).toContain('유효한 블록 인덱스를 입력하세요 (1 이상의 숫자).');
    });

    it('GET /transactions/block/:blockIndex: 존재하지 않는 블록 인덱스로 조회 시 404 에러를 반환해야 합니다.', async () => {
        const res = await request(app).get('/transactions/block/999'); // 존재하지 않는 인덱스
        expect(res.statusCode).toEqual(404);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('블록을 찾을 수 없습니다.');
    });
});