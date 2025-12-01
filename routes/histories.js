const express = require('express'); // Express 프레임워크를 가져옵니다.
const router = express.Router(); // Express 라우터 인스턴스를 생성합니다.

// 이 라우터는 app.js에서 설정한 블록체인 인스턴스에 접근합니다.

// GET /histories/:productId : 특정 상품의 모든 거래 이력을 조회합니다.
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

module.exports = router; // 라우터를 모듈로 내보냅니다.
