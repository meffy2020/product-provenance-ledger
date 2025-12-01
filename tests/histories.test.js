const request = require('supertest');
const app = require('../app');
const { v4: uuidv4 } = require('uuid');

describe('Histories API', () => {
    let blockchain;
    let testProductId;
    let testTransactionId;
    let testAddress;
    let testBlockHash;
    let testBlockIndex;

    beforeEach(() => {
        blockchain = app.get('blockchain');
        blockchain.chain = [];
        blockchain.pendingTransactions = [];
        blockchain.networkNodes = [];
        blockchain.createNewBlock(100, '0', '0'); // Genesis Block

        // Test Setup: Create some transactions and mine blocks to test histories
        testProductId = 'test-product-123';
        testAddress = 'test-address-sender';

        // First transaction and block
        blockchain.createNewTransaction(testAddress, 'recipient-1', testProductId);
        testTransactionId = blockchain.pendingTransactions[0].transactionId; // Capture a transaction ID for testing
        
        let lastBlock = blockchain.getLastBlock();
        let previousBlockHash = lastBlock.hash;
        let currentBlockData = { transactions: [...blockchain.pendingTransactions], index: lastBlock.index + 1 };
        let nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData);
        let blockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);
        let newBlock = blockchain.createNewBlock(nonce, previousBlockHash, blockHash);
        testBlockHash = newBlock.hash;
        testBlockIndex = newBlock.index;

        // Second transaction and block (different product/address for broader tests)
        blockchain.createNewTransaction('another-sender', testAddress, 'another-product');
        lastBlock = blockchain.getLastBlock();
        previousBlockHash = lastBlock.hash;
        currentBlockData = { transactions: [...blockchain.pendingTransactions], index: lastBlock.index + 1 };
        nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData);
        blockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);
        blockchain.createNewBlock(nonce, previousBlockHash, blockHash);
    });

    // GET /histories/:productId
    it('GET /histories/:productId: 특정 상품의 모든 거래 이력을 반환해야 합니다.', async () => {
        const res = await request(app).get(`/histories/${testProductId}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.history).toHaveLength(1);
        expect(res.body.history[0].productId).toBe(testProductId);
    });

    it('GET /histories/:productId: 존재하지 않는 상품 ID로 조회 시 404 에러를 반환해야 합니다.', async () => {
        const res = await request(app).get('/histories/non-existent-product');
        expect(res.statusCode).toEqual(404);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('거래 이력을 찾을 수 없습니다.');
    });

    // GET /histories/transactions/:transactionId
    it('GET /histories/transactions/:transactionId: 특정 트랜잭션의 상세 정보를 반환해야 합니다.', async () => {
        const res = await request(app).get(`/histories/transactions/${testTransactionId}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.transaction.transactionId).toBe(testTransactionId);
        expect(res.body.block).toBeDefined();
    });

    it('GET /histories/transactions/:transactionId: 존재하지 않는 트랜잭션 ID로 조회 시 404 에러를 반환해야 합니다.', async () => {
        const res = await request(app).get(`/histories/transactions/${uuidv4().split('-').join('')}`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('찾을 수 없습니다.');
    });

    // GET /histories/address/:address
    it('GET /histories/address/:address: 특정 주소와 관련된 모든 거래를 반환해야 합니다.', async () => {
        const res = await request(app).get(`/histories/address/${testAddress}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.transactions.length).toBeGreaterThanOrEqual(1);
        const hasSenderOrRecipient = res.body.transactions.every(tx => tx.sender === testAddress || tx.recipient === testAddress);
        expect(hasSenderOrRecipient).toBe(true);
    });

    it('GET /histories/address/:address: 존재하지 않는 주소로 조회 시 404 에러를 반환해야 합니다.', async () => {
        const res = await request(app).get('/histories/address/non-existent-address');
        expect(res.statusCode).toEqual(404);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('거래 이력을 찾을 수 없습니다.');
    });

    // GET /histories/block/:blockHash
    it('GET /histories/block/:blockHash: 특정 블록 해시로 블록 정보를 반환해야 합니다.', async () => {
        const res = await request(app).get(`/histories/block/${testBlockHash}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.block.hash).toBe(testBlockHash);
        expect(res.body.block.index).toBe(testBlockIndex);
    });

    it('GET /histories/block/:blockHash: 존재하지 않는 블록 해시로 조회 시 404 에러를 반환해야 합니다.', async () => {
        const res = await request(app).get(`/histories/block/${'a'.repeat(64)}`); // Invalid hash
        expect(res.statusCode).toEqual(404);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('블록을 찾을 수 없습니다.');
    });

    // GET /histories/latest/:count
    it('GET /histories/latest/:count: 최신 N개의 트랜잭션을 반환해야 합니다.', async () => {
        const count = 2;
        const res = await request(app).get(`/histories/latest/${count}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.transactions).toHaveLength(count);
        // 트랜잭션들이 최신순으로 정렬되어 있는지 추가 검증 필요 (timestamp 비교 등)
        expect(res.body.transactions[0].timestamp).toBeGreaterThanOrEqual(res.body.transactions[1].timestamp);
    });

    it('GET /histories/latest/:count: 트랜잭션이 없을 때 404 에러를 반환해야 합니다.', async () => {
        // blockchain을 초기화하고 제네시스 블록만 남겨둡니다.
        blockchain.chain = [];
        blockchain.pendingTransactions = [];
        blockchain.createNewBlock(100, '0', '0'); // Genesis Block without transactions

        const res = await request(app).get('/histories/latest/5');
        expect(res.statusCode).toEqual(404);
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('최신 트랜잭션을 찾을 수 없습니다.');
    });
});
