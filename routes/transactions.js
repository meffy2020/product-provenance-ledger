const express = require('express'); // Express 프레임워크를 가져옵니다.
const router = express.Router(); // Express 라우터 인스턴스를 생성합니다.

// 이 라우터는 블록체인 인스턴스에 접근해야 합니다.
// 'req.app.get('blockchain')'을 통해 Express 애플리케이션의 로컬 객체에서 블록체인 인스턴스를 가져옵니다.

// GET 요청: 모든 처리 대기 중인(pending) 트랜잭션 목록을 반환합니다.
router.get('/', (req, res) => {
    const blockchain = req.app.get('blockchain'); // 블록체인 인스턴스를 가져옵니다.
    res.json({
        pendingTransactions: blockchain.pendingTransactions // 처리 대기 중인 트랜잭션 목록을 JSON 형태로 응답합니다.
    });
});

// POST 요청: 새로운 트랜잭션을 생성하여 처리 대기 목록에 추가합니다.
router.post('/', (req, res) => {
    const blockchain = req.app.get('blockchain'); // 블록체인 인스턴스를 가져옵니다.
    const { sender, recipient, productId } = req.body; // 요청 본문에서 발신자, 수신자, 상품 ID를 추출합니다.

    // 필수 필드(sender, recipient, productId)가 누락되었는지 검증합니다.
    if (!sender || !recipient || !productId) {
        return res.status(400).json({
            result: "Fail",
            error: "sender, recipient, and productId는 필수 항목입니다." // 필수 항목 누락 시 오류 응답
        });
    }

    // 블록체인 인스턴스의 createNewTransaction 메서드를 호출하여 새로운 트랜잭션을 생성합니다.
    const newTransaction = blockchain.createNewTransaction(sender, recipient, productId);

    // 실제 분산 시스템에서는 이 트랜잭션을 네트워크의 다른 노드들에게 브로드캐스트해야 합니다.
    // 여기서는 일단 현재 노드의 처리 대기 목록에 추가하는 것으로 시뮬레이션합니다.
    
    // 성공 응답을 전송합니다.
    res.status(201).json({
        result: "Success",
        message: `트랜잭션이 생성되어 처리 대기 목록에 추가되었습니다. 다음 블록에 포함될 예정입니다.`,
        transaction: newTransaction // 생성된 트랜잭션 정보를 함께 반환합니다.
    });
});

module.exports = router; // 라우터를 모듈로 내보냅니다.