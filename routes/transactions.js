const express = require('express');
const router = express.Router();

// This router needs access to the blockchain instance.
// We will pass it via a closure or app.locals.
// For now, let's assume it's available on `req.app.get('blockchain')`

// GET all pending transactions
router.get('/', (req, res) => {
    const blockchain = req.app.get('blockchain');
    res.json({
        pendingTransactions: blockchain.pendingTransactions
    });
});

// POST a new transaction
router.post('/', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { sender, recipient, productId } = req.body;

    if (!sender || !recipient || !productId) {
        return res.status(400).json({
            result: "Fail",
            error: "sender, recipient, and productId are required."
        });
    }

    const newTransaction = blockchain.createNewTransaction(sender, recipient, productId);

    // In a real distributed system, you would broadcast this transaction.
    // Here we just add it to the pending list.
    
    res.status(201).json({
        result: "Success",
        message: `Transaction created and added to pending transactions. It will be added to the chain in the next block.`,
        transaction: newTransaction
    });
});

module.exports = router;
