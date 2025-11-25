const express = require('express');
const router = express.Router();
const axios = require('axios');

// This router needs access to the blockchain instance.
// We will assume it's available on `req.app.get('blockchain')`

// Register a node and broadcast it to the whole network
router.post('/register-and-broadcast-node', async (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { newNodeUrl } = req.body;

    // 1. Register the new node with the current node
    if (blockchain.networkNodes.indexOf(newNodeUrl) === -1 && blockchain.nodeAddress !== newNodeUrl) {
        blockchain.networkNodes.push(newNodeUrl);
    }

    const registrationPromises = [];
    // 2. Broadcast the new node to all other nodes in the network
    blockchain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            method: 'post',
            url: `${networkNodeUrl}/nodes/register-node`,
            data: { newNodeUrl: newNodeUrl }
        };
        registrationPromises.push(axios(requestOptions));
    });

    try {
        await Promise.all(registrationPromises);

        // 3. Register all existing nodes with the new node
        const bulkRegisterOptions = {
            method: 'post',
            url: `${newNodeUrl}/nodes/register-nodes-bulk`,
            data: { allNetworkNodes: [...blockchain.networkNodes, blockchain.nodeAddress] }
        };
        await axios(bulkRegisterOptions);
        
        res.json({ result: "Success", message: 'New node registered with network successfully.' });
    } catch (error) {
        res.status(500).json({ result: "Fail", error: 'Failed to broadcast node registration.' });
    }
});

// Register a node with the network (received from another node)
router.post('/register-node', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { newNodeUrl } = req.body;

    const nodeNotAlreadyPresent = blockchain.networkNodes.indexOf(newNodeUrl) === -1;
    const notCurrentNode = blockchain.nodeAddress !== newNodeUrl;

    if (nodeNotAlreadyPresent && notCurrentNode) {
        blockchain.networkNodes.push(newNodeUrl);
    }
    
    res.json({ result: "Success", message: 'New node registered successfully.' });
});

// Register multiple nodes at once (for a new node joining the network)
router.post('/register-nodes-bulk', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { allNetworkNodes } = req.body;

    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = blockchain.networkNodes.indexOf(networkNodeUrl) === -1;
        const notCurrentNode = blockchain.nodeAddress !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) {
            blockchain.networkNodes.push(networkNodeUrl);
        }
    });

    res.json({ result: "Success", message: 'Bulk registration successful.' });
});


// Consensus Algorithm - Longest Chain Rule
router.get('/consensus', async (req, res) => {
    const blockchain = req.app.get('blockchain');
    const requestPromises = [];

    // 1. Get all chains from other nodes
    blockchain.networkNodes.forEach(networkNodeUrl => {
        requestPromises.push(axios.get(`${networkNodeUrl}/blockchain`));
    });

    try {
        const blockchains = await Promise.all(requestPromises);
        let maxChainLength = blockchain.chain.length;
        let newLongestChain = null;
        let newPendingTransactions = null;

        // 2. Find the longest valid chain
        for (const response of blockchains) {
            const remoteChain = response.data.chain;
            if (remoteChain.length > maxChainLength && blockchain.chainIsValid(remoteChain)) {
                maxChainLength = remoteChain.length;
                newLongestChain = remoteChain;
                newPendingTransactions = response.data.pendingTransactions;
            }
        }

        // 3. Replace the current chain if a longer valid chain is found
        if (!newLongestChain || (newLongestChain && !blockchain.chainIsValid(newLongestChain))) {
            res.json({
                result: "Success",
                message: 'Current chain has not been replaced.',
                chain: blockchain.chain
            });
        } else {
            blockchain.chain = newLongestChain;
            blockchain.pendingTransactions = newPendingTransactions;
            res.json({
                result: "Success",
                message: 'This chain has been replaced with the longest valid chain.',
                chain: blockchain.chain
            });
        }
    } catch (error) {
        res.status(500).json({ result: "Fail", error: 'Failed to reach consensus.' });
    }
});


module.exports = router;
