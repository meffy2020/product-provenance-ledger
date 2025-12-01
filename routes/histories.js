const express = require('express'); // Express 프레임워크를 가져옵니다.
const router = express.Router(); // Express 라우터 인스턴스를 생성합니다.

// 이 라우터는 app.js에서 설정한 블록체인 인스턴스에 접근합니다.

// GET /histories/:productId : 특정 상품의 모든 거래 이력을 조회합니다. (기존)
router.get('/:productId', (req, res) => {
    const blockchain = req.app.get('blockchain'); // 블록체인 인스턴스를 가져옵니다.
    const { productId } = req.params; // URL 파라미터에서 조회할 상품의 ID를 가져옵니다.

    const transactionHistory = []; // 해당 상품의 거래 내역을 담을 배열입니다.
    
    // 블록체인의 모든 블록을 순회하여 관련 거래를 찾습니다.
    blockchain.chain.forEach(block => {
        // 각 블록 안에 있는 모든 트랜잭션을 순회합니다.
        block.transactions.forEach(transaction => {
            // 트랜잭션의 productId가 요청된 productId와 일치하는지 확인합니다.
            if (transaction.productId === productId) {
                // 일치하면, 거래 정보와 함께 해당 거래가 포함된 블록의 정보(인덱스, 해시)를 추가하여 배열에 저장합니다.
                transactionHistory.push({
                    ...transaction,
                    blockIndex: block.index,
                    blockHash: block.hash
                });
            }
        });
    });

    // 거래 내역이 하나도 없을 경우, 404 Not Found 오류를 응답합니다.
    if (transactionHistory.length === 0) {
        return res.status(404).json({
            result: "Fail",
            error: `상품 ID [${productId}]에 대한 거래 이력을 찾을 수 없습니다.`
        });
    }

    // 조회된 거래 이력을 성공 메시지와 함께 응답합니다.
    res.json({
        result: "Success",
        message: `상품 ID [${productId}]에 대한 ${transactionHistory.length}개의 거래를 찾았습니다.`,
        history: transactionHistory
    });
});

// GET /histories/transactions/:transactionId : 특정 트랜잭션 ID로 트랜잭션 상세 정보를 조회합니다.
router.get('/transactions/:transactionId', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { transactionId } = req.params;
    let foundTransaction = null;
    let foundBlock = null;

    blockchain.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if (transaction.transactionId === transactionId) {
                foundTransaction = transaction;
                foundBlock = block;
            }
        });
    });

    if (!foundTransaction) {
        return res.status(404).json({
            result: "Fail",
            error: `트랜잭션 ID [${transactionId}]를 찾을 수 없습니다.`
        });
    }

    res.json({
        result: "Success",
        message: `트랜잭션 ID [${transactionId}]에 대한 정보를 찾았습니다.`,
        transaction: foundTransaction,
        block: {
            index: foundBlock.index,
            timestamp: foundBlock.timestamp,
            hash: foundBlock.hash,
            previousBlockHash: foundBlock.previousBlockHash,
            nonce: foundBlock.nonce
        }
    });
});

// GET /histories/address/:address : 특정 지갑 주소와 관련된 모든 트랜잭션(송신 및 수신)을 조회합니다.
router.get('/address/:address', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { address } = req.params;
    const addressTransactions = [];

    blockchain.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if (transaction.sender === address || transaction.recipient === address) {
                addressTransactions.push({
                    ...transaction,
                    blockIndex: block.index,
                    blockHash: block.hash
                });
            }
        });
    });

    if (addressTransactions.length === 0) {
        return res.status(404).json({
            result: "Fail",
            error: `주소 [${address}]에 대한 거래 이력을 찾을 수 없습니다.`
        });
    }

    res.json({
        result: "Success",
        message: `주소 [${address}]에 대한 ${addressTransactions.length}개의 거래를 찾았습니다.`,
        transactions: addressTransactions
    });
});

// GET /histories/block/:blockHash : 블록 해시로 식별된 특정 블록에 포함된 모든 트랜잭션을 조회합니다.
router.get('/block/:blockHash', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { blockHash } = req.params;
    let foundBlock = null;

    blockchain.chain.forEach(block => {
        if (block.hash === blockHash) {
            foundBlock = block;
        }
    });

    if (!foundBlock) {
        return res.status(404).json({
            result: "Fail",
            error: `블록 해시 [${blockHash}]에 해당하는 블록을 찾을 수 없습니다.`
        });
    }

    res.json({
        result: "Success",
        message: `블록 해시 [${blockHash}]에 해당하는 블록 정보를 찾았습니다.`,
        block: foundBlock
    });
});

// GET /histories/latest/:count : 블록체인 전체에서 최신 count개의 트랜잭션을 조회합니다.
router.get('/latest/:count', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const count = parseInt(req.params.count);
    const allTransactions = [];

    // 모든 블록의 트랜잭션을 역순으로 가져와서 allTransactions 배열에 추가합니다.
    for (let i = blockchain.chain.length - 1; i >= 0; i--) {
        const block = blockchain.chain[i];
        for (let j = block.transactions.length - 1; j >= 0; j--) {
            allTransactions.push({
                ...block.transactions[j],
                blockIndex: block.index,
                blockHash: block.hash
            });
            if (allTransactions.length >= count) {
                break; // 필요한 만큼의 트랜잭션을 찾으면 반복을 중단합니다.
            }
        }
        if (allTransactions.length >= count) {
            break;
        }
    }

    if (allTransactions.length === 0) {
        return res.status(404).json({
            result: "Fail",
            error: `최신 트랜잭션을 찾을 수 없습니다.`
        });
    }
    
    // 요청된 개수만큼의 최신 트랜잭션을 반환합니다.
    res.json({
        result: "Success",
        message: `최신 ${Math.min(count, allTransactions.length)}개의 트랜잭션을 찾았습니다.`,
        transactions: allTransactions.slice(0, count)
    });
});

module.exports = router; // 라우터를 모듈로 내보냅니다.
