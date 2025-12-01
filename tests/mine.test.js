const request = require('supertest');
const app = require('../app');

describe('Mine API', () => {
    let blockchain;
    const minerAddress = 'test-miner-address';

    beforeEach(() => {
        blockchain = app.get('blockchain');
        // 각 테스트가 독립적으로 실행될 수 있도록 블록체인 상태를 초기화합니다.
        // mine API 테스트는 setInterval을 사용하므로, beforeEach에서 초기화 후 모든 타이머를 클리어합니다.
        if (blockchain.miningInterval) {
            clearInterval(blockchain.miningInterval);
            blockchain.miningInterval = null;
        }
        blockchain.chain = [];
        blockchain.pendingTransactions = [];
        blockchain.networkNodes = [];
        blockchain.miningDifficulty = 4; // 기본 난이도로 초기화
        blockchain.createNewBlock(100, '0', '0'); // 제네시스 블록
    });

    afterEach(() => {
        // 테스트 후 혹시 모를 연속 채굴 타이머를 확실히 중지합니다.
        if (blockchain.miningInterval) {
            clearInterval(blockchain.miningInterval);
            blockchain.miningInterval = null;
        }
    });

    // POST /mine
    it('POST /mine: 새로운 블록을 성공적으로 채굴하고 보상 트랜잭션을 생성해야 합니다.', async () => {
        blockchain.createNewTransaction('sender1', 'recipient1', 'product1');
        const initialChainLength = blockchain.chain.length;
        const initialPendingTxCount = blockchain.pendingTransactions.length;

        const res = await request(app)
            .post('/mine')
            .send({ minerAddress: minerAddress });

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('새로운 블록이 성공적으로 채굴되었습니다!');
        expect(res.body.block).toBeDefined();
        expect(blockchain.chain.length).toBe(initialChainLength + 1);
        // 채굴 보상 트랜잭션이 추가되므로 pendingTransactions는 1개가 되어야 합니다.
        expect(blockchain.pendingTransactions).toHaveLength(1); 
        expect(blockchain.pendingTransactions[0].recipient).toBe(minerAddress);
        expect(blockchain.pendingTransactions[0].productId).toBe('MINING-REWARD');
    });

    it('POST /mine: 채굴자 주소 누락 시 400 에러를 반환해야 합니다.', async () => {
        const res = await request(app)
            .post('/mine')
            .send({}); // minerAddress 누락

        expect(res.statusCode).toEqual(400);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('채굴 보상을 받으려면 채굴자 주소가 필요합니다.');
    });

    // GET /mine/status
    it('GET /mine/status: 현재 채굴 상태를 반환해야 합니다.', async () => {
        const res = await request(app).get('/mine/status');
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.lastBlock).toEqual(blockchain.getLastBlock());
        expect(res.body.pendingTransactionsCount).toBe(blockchain.pendingTransactions.length);
        expect(res.body.miningDifficulty).toBe(blockchain.miningDifficulty);
        expect(res.body.isMiningActive).toBe(false); // 초기 상태는 false
    });

    // POST /mine/start
    it('POST /mine/start: 연속 채굴을 성공적으로 시작해야 합니다.', async () => {
        const res = await request(app)
            .post('/mine/start')
            .send({ minerAddress: minerAddress });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('연속 채굴이 채굴자');
        expect(blockchain.miningInterval).not.toBeNull();
    });

    it('POST /mine/start: 이미 채굴이 진행 중일 때 400 에러를 반환해야 합니다.', async () => {
        // 먼저 채굴을 시작합니다.
        await request(app)
            .post('/mine/start')
            .send({ minerAddress: minerAddress });

        // 다시 채굴 시작을 시도합니다.
        const res = await request(app)
            .post('/mine/start')
            .send({ minerAddress: minerAddress });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('이미 채굴이 진행 중입니다.');
    });

    it('POST /mine/start: 채굴자 주소 누락 시 400 에러를 반환해야 합니다.', async () => {
        const res = await request(app)
            .post('/mine/start')
            .send({});

        expect(res.statusCode).toEqual(400);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('채굴자 주소가 필요합니다.');
    });

    // POST /mine/stop
    it('POST /mine/stop: 연속 채굴을 성공적으로 중지해야 합니다.', async () => {
        // 먼저 채굴을 시작합니다.
        await request(app)
            .post('/mine/start')
            .send({ minerAddress: minerAddress });
        
        // 채굴 중지 요청을 보냅니다.
        const res = await request(app).post('/mine/stop');

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('연속 채굴이 중지되었습니다.');
        expect(blockchain.miningInterval).toBeNull();
    });

    it('POST /mine/stop: 진행 중인 채굴이 없을 때 400 에러를 반환해야 합니다.', async () => {
        const res = await request(app).post('/mine/stop');
        
        expect(res.statusCode).toEqual(400);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('진행 중인 채굴이 없습니다.');
    });

    // GET /mine/difficulty
    it('GET /mine/difficulty: 현재 채굴 난이도를 반환해야 합니다.', async () => {
        const res = await request(app).get('/mine/difficulty');
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.difficulty).toBe(blockchain.miningDifficulty);
    });

    // PUT /mine/difficulty
    it('PUT /mine/difficulty: 채굴 난이도를 성공적으로 설정해야 합니다.', async () => {
        const newDifficulty = 5;
        const res = await request(app)
            .put('/mine/difficulty')
            .send({ newDifficulty: newDifficulty });

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain(`채굴 난이도가 ${newDifficulty}로 설정되었습니다.`);
        expect(res.body.newDifficulty).toBe(newDifficulty);
        expect(blockchain.miningDifficulty).toBe(newDifficulty);
    });

    it('PUT /mine/difficulty: 유효하지 않은 난이도 설정 시 400 에러를 반환해야 합니다.', async () => {
        const res1 = await request(app)
            .put('/mine/difficulty')
            .send({ newDifficulty: 'invalid' });
        expect(res1.statusCode).toEqual(400);
        expect(res1.body.result).toBe('Fail');

        const res2 = await request(app)
            .put('/mine/difficulty')
            .send({ newDifficulty: 0 });
        expect(res2.statusCode).toEqual(400);
        expect(res2.body.result).toBe('Fail');
        
        const res3 = await request(app)
            .put('/mine/difficulty')
            .send({ newDifficulty: 65 }); // Max 64 for SHA256
        expect(res3.statusCode).toEqual(400);
        expect(res3.body.result).toBe('Fail');
    });
});
