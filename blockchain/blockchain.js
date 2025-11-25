const crypto = require('crypto');

class Blockchain {
    constructor() {
        this.chain = [];
        this.pendingTransactions = [];
        this.nodeAddress = require('uuid').v4().split('-').join(''); // Generate unique address for this node
        this.networkNodes = []; // To simulate a network of nodes

        // Create the Genesis Block
        this.createNewBlock(100, '0', '0');
    }

    /**
     * Creates a new block and adds it to the chain.
     * @param {number} nonce - The nonce from the proof of work.
     * @param {string} previousBlockHash - The hash of the previous block.
     * @param {string} hash - The hash of the current block.
     * @returns {object} The new block.
     */
    createNewBlock(nonce, previousBlockHash, hash) {
        const newBlock = {
            index: this.chain.length + 1,
            timestamp: Date.now(),
            transactions: this.pendingTransactions,
            nonce: nonce,
            hash: hash,
            previousBlockHash: previousBlockHash,
        };

        this.pendingTransactions = [];
        this.chain.push(newBlock);

        return newBlock;
    }

    /**
     * Returns the last block on the chain.
     * @returns {object} The last block.
     */
    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    /**
     * Creates a new transaction to be added to the pending transactions.
     * @param {string} sender - The sender's address.
     * @param {string} recipient - The recipient's address.
     * @param {string} productId - The ID of the product being traded.
     * @returns {object} The new transaction.
     */
    createNewTransaction(sender, recipient, productId) {
        const newTransaction = {
            sender: sender,
            recipient: recipient,
            productId: productId,
            transactionId: crypto.randomBytes(16).toString('hex'),
            timestamp: Date.now()
        };

        this.pendingTransactions.push(newTransaction);

        return newTransaction;
    }

    /**
     * Hashes a block's data.
     * @param {string} previousBlockHash - The hash of the previous block.
     * @param {object} currentBlockData - The data of the current block.
     * @param {number} nonce - The nonce.
     * @returns {string} The hash.
     */
    hashBlock(previousBlockHash, currentBlockData, nonce) {
        const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
        const hash = crypto.createHash('sha256').update(dataAsString).digest('hex');
        return hash;
    }

    /**
     * Simple Proof of Work: find a nonce that produces a hash with 4 leading zeros.
     * @param {string} previousBlockHash - The hash of the previous block.
     * @param {object} currentBlockData - The data of the current block.
     * @returns {number} The nonce.
     */
    proofOfWork(previousBlockHash, currentBlockData) {
        let nonce = 0;
        let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        while (hash.substring(0, 4) !== '0000') {
            nonce++;
            hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        }
        return nonce;
    }

    /**
     * Validates a chain.
     * @param {Array<object>} blockchain - The blockchain to validate.
     * @returns {boolean} True if the chain is valid, false otherwise.
     */
    chainIsValid(blockchain) {
        let validChain = true;

        for (var i = 1; i < blockchain.length; i++) {
            const currentBlock = blockchain[i];
            const prevBlock = blockchain[i - 1];
            const blockHash = this.hashBlock(prevBlock.hash, { transactions: currentBlock.transactions, index: currentBlock.index }, currentBlock.nonce);

            if (blockHash.substring(0, 4) !== '0000') validChain = false;
            if (currentBlock.previousBlockHash !== prevBlock.hash) validChain = false;
        };

        const genesisBlock = blockchain[0];
        const correctNonce = genesisBlock.nonce === 100;
        const correctPreviousBlockHash = genesisBlock.previousBlockHash === '0';
        const correctHash = genesisBlock.hash === '0';
        const correctTransactions = genesisBlock.transactions.length === 0;

        if (!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) validChain = false;

        return validChain;
    }
}

module.exports = Blockchain;
