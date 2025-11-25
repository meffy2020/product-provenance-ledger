const express = require('express');
const router = express.Router();

// This router needs access to the blockchain instance.
// We will assume it's available on `req.app.get('blockchain')`

router.post('/', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { minerAddress } = req.body;

    if (!minerAddress) {
        return res.status(400).json({
            result: "Fail",
            error: "A miner address is required to receive the mining reward."
        });
    }

    // 1. Get previous block hash
    const lastBlock = blockchain.getLastBlock();
    const previousBlockHash = lastBlock.hash;

    // 2. Prepare data for the new block (all pending transactions)
    const currentBlockData = {
        transactions: blockchain.pendingTransactions,
        index: lastBlock.index + 1
    };

    // 3. Find the correct nonce through Proof of Work
    const nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData);

    // 4. Hash the new block's data
    const blockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);

    // 5. Create a reward transaction for the miner
    // This is a simplification; in real Bitcoin, this is the coinbase transaction.
    blockchain.createNewTransaction('00-REWARD-SYSTEM', minerAddress, 'MINING-REWARD');

    // 6. Create the new block
    const newBlock = blockchain.createNewBlock(nonce, previousBlockHash, blockHash);

    // In a real distributed system, this new block would be broadcast to the network.

    res.json({
        result: "Success",
        message: "New block mined successfully!",
        block: newBlock
    });
});

module.exports = router;
