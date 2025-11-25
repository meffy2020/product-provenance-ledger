const express = require('express');
const router = express.Router();

// This router needs access to the blockchain instance.
// We will assume it's available on `req.app.get('blockchain')`

router.get('/:productId', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { productId } = req.params;

    const transactionHistory = [];
    
    // Iterate through the entire chain to find relevant transactions
    blockchain.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if (transaction.productId === productId) {
                transactionHistory.push({
                    ...transaction,
                    blockIndex: block.index,
                    blockHash: block.hash
                });
            }
        });
    });

    if (transactionHistory.length === 0) {
        return res.status(404).json({
            result: "Fail",
            error: `No transaction history found for productId: ${productId}`
        });
    }

    res.json({
        result: "Success",
        message: `Found ${transactionHistory.length} transaction(s) for productId: ${productId}`,
        history: transactionHistory
    });
});

module.exports = router;
