const request = require('supertest');
const app = require('../app');
const Blockchain = require('../blockchain/blockchain');

describe('Blockchain API', () => {

    let blockchain;

    beforeEach(() => {
        // Get a fresh blockchain instance for each test
        blockchain = app.get('blockchain');
        // Reset the blockchain state
        blockchain.chain = [];
        blockchain.pendingTransactions = [];
        blockchain.networkNodes = [];
        blockchain.createNewBlock(100, '0', '0'); // Recreate genesis block
    });

    it('GET /blockchain should return the blockchain', async () => {
        const res = await request(app).get('/blockchain');
        expect(res.statusCode).toEqual(200);
        expect(res.body.chain).toHaveLength(1);
        expect(res.body.chain[0].nonce).toBe(100); // Genesis block
    });

    it('should create a transaction, mine a block, and then find the history', async () => {
        const productId = 'sneakers-123';

        // 1. Create a new transaction
        const transactionRes = await request(app)
            .post('/transactions')
            .send({
                sender: 'Alice',
                recipient: 'Bob',
                productId: productId
            });
        
        expect(transactionRes.statusCode).toEqual(201);
        expect(transactionRes.body.result).toBe('Success');
        expect(blockchain.pendingTransactions).toHaveLength(1);

        // 2. Mine a new block
        const mineRes = await request(app)
            .post('/mine')
            .send({ minerAddress: 'Charlie' });

        expect(mineRes.statusCode).toEqual(200);
        expect(mineRes.body.result).toBe('Success');
        expect(mineRes.body.block.index).toBe(2);
        // The new block should contain 2 transactions: the trade and the reward
        expect(mineRes.body.block.transactions).toHaveLength(2);
        expect(blockchain.chain).toHaveLength(2);
        expect(blockchain.pendingTransactions).toHaveLength(0);

        // 3. Get the history for the product
        const historyRes = await request(app).get(`/histories/${productId}`);
        
        expect(historyRes.statusCode).toEqual(200);
        expect(historyRes.body.result).toBe('Success');
        expect(historyRes.body.history).toHaveLength(1);
        expect(historyRes.body.history[0].sender).toBe('Alice');
        expect(historyRes.body.history[0].recipient).toBe('Bob');
        expect(historyRes.body.history[0].blockIndex).toBe(2);
    });

    it('should correctly validate a chain', () => {
        // Add a block
        blockchain.createNewTransaction('A', 'B', 'P1');
        const lastBlock = blockchain.getLastBlock();
        const previousBlockHash = lastBlock.hash;
        const currentBlockData = {
            transactions: blockchain.pendingTransactions,
            index: lastBlock.index + 1
        };
        const nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData);
        const blockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);
        blockchain.createNewBlock(nonce, previousBlockHash, blockHash);

        // Chain should be valid
        expect(blockchain.chainIsValid(blockchain.chain)).toBe(true);

        // Tamper with the chain
        blockchain.chain[1].transactions[0].recipient = 'Z';
        
        // Chain should now be invalid
        expect(blockchain.chainIsValid(blockchain.chain)).toBe(false);
    });

});
