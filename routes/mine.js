const express = require('express'); // Express 프레임워크를 가져옵니다.
const router = express.Router(); // Express 라우터 인스턴스를 생성합니다.

// 이 라우터는 app.js에서 설정한 블록체인 인스턴스에 접근합니다.
// `req.app.get('blockchain')`을 통해 가져옵니다.

// POST /mine: 새로운 블록을 채굴(생성)하는 엔드포인트입니다.
router.post('/', async (req, res) => { // 비동기 처리를 위해 async 키워드를 추가합니다.
    // 1. app 객체에서 블록체인 인스턴스를 가져옵니다.
    const blockchain = req.app.get('blockchain');
    // 2. 채굴 보상을 받을 주소를 요청 본문에서 가져옵니다.
    const { minerAddress } = req.body;

    // 3. 채굴자 주소가 없으면 오류를 반환합니다.
    if (!minerAddress) {
        return res.status(400).json({
            result: "Fail",
            error: "채굴 보상을 받으려면 채굴자 주소가 필요합니다."
        });
    }

    // --- 채굴 프로세스 시작 ---

    // 4. 마지막 블록을 가져와서 이전 블록의 해시 값을 확보합니다.
    const lastBlock = blockchain.getLastBlock();
    const previousBlockHash = lastBlock.hash;

    // 5. 새 블록에 포함될 데이터를 준비합니다. 여기서는 처리 대기 중인 모든 트랜잭션이 해당됩니다.
    const currentBlockData = {
        transactions: blockchain.pendingTransactions,
        index: lastBlock.index + 1
    };

    // 6. 작업 증명(Proof of Work)을 비동기적으로 수행하여 올바른 nonce 값을 찾습니다.
    const nonce = await blockchain.proofOfWork(previousBlockHash, currentBlockData);

    // 7. 찾은 nonce 값과 다른 데이터들을 이용해 새 블록의 해시 값을 계산합니다.
    const blockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);

    // 9. nonce, 이전 블록 해시, 현재 블록 해시 등의 모든 정보를 종합하여 새 블록을 생성합니다.
    const newBlock = blockchain.createNewBlock(nonce, previousBlockHash, blockHash);

    // 8. 채굴에 성공했으므로, 시스템에서 채굴자에게 보상을 지급하는 특별한 트랜잭션을 생성합니다.
    //    이 보상 트랜잭션은 새로 채굴된 블록이 아닌, 다음 블록에 포함될 처리 대기 트랜잭션으로 추가됩니다.
    blockchain.createNewTransaction('00-REWARD-SYSTEM', minerAddress, 'MINING-REWARD');

    // 실제 분산 시스템에서는 이 새 블록을 네트워크의 모든 노드에 브로드캐스트해야 합니다.

    // 10. 채굴 성공 메시지와 함께 생성된 새 블록 정보를 응답합니다.
    res.json({
        result: "Success",
        message: "새로운 블록이 성공적으로 채굴되었습니다!",
        block: newBlock
    });
});

// GET /mine/status: 현재 채굴 상태 (마지막 채굴된 블록, 보류 중인 트랜잭션 수, 채굴 난이도 등)를 반환합니다.
router.get('/status', (req, res) => {
    const blockchain = req.app.get('blockchain');
    res.json({
        result: "Success",
        message: "현재 채굴 상태입니다.",
        lastBlock: blockchain.getLastBlock(),
        pendingTransactionsCount: blockchain.pendingTransactions.length,
        miningDifficulty: blockchain.miningDifficulty,
        isMiningActive: blockchain.miningInterval !== null
    });
});

// POST /mine/start: 연속 채굴을 시작합니다. (데모/테스트용)
router.post('/start', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { minerAddress } = req.body;

    if (!minerAddress) {
        return res.status(400).json({
            result: "Fail",
            error: "채굴 보상을 받을 채굴자 주소가 필요합니다."
        });
    }

    if (blockchain.miningInterval) {
        return res.status(400).json({
            result: "Fail",
            error: "이미 채굴이 진행 중입니다."
        });
    }

    // 일정한 간격으로 채굴을 시도합니다. (여기서는 간단한 예시)
    blockchain.miningInterval = setInterval(async () => {
        try {
            const lastBlock = blockchain.getLastBlock();
            const previousBlockHash = lastBlock.hash;
            const currentBlockData = {
                transactions: [...blockchain.pendingTransactions], // 트랜잭션 복사
                index: lastBlock.index + 1
            };
            const nonce = await blockchain.proofOfWork(previousBlockHash, currentBlockData);
            const blockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);

            blockchain.createNewTransaction('00-REWARD-SYSTEM', minerAddress, 'MINING-REWARD');
            const newBlock = blockchain.createNewBlock(nonce, previousBlockHash, blockHash);
            
            console.log(`[Miner: ${minerAddress}] New block mined: ${newBlock.index}`);
        } catch (error) {
            console.error("Continuous mining error:", error);
            // 오류 발생 시 채굴을 중단할 수도 있습니다.
            // clearInterval(blockchain.miningInterval);
            // blockchain.miningInterval = null;
        }
    }, 10000); // 10초마다 채굴 시도

    res.json({
        result: "Success",
        message: `연속 채굴이 채굴자 [${minerAddress}]에 의해 시작되었습니다. 난이도: ${blockchain.miningDifficulty}`
    });
});

// POST /mine/stop: 연속 채굴을 중지합니다.
router.post('/stop', (req, res) => {
    const blockchain = req.app.get('blockchain');

    if (!blockchain.miningInterval) {
        return res.status(400).json({
            result: "Fail",
            error: "진행 중인 채굴이 없습니다."
        });
    }

    clearInterval(blockchain.miningInterval);
    blockchain.miningInterval = null;

    res.json({
        result: "Success",
        message: "연속 채굴이 중지되었습니다."
    });
});

// GET /mine/difficulty: 현재 채굴 난이도를 반환합니다.
router.get('/difficulty', (req, res) => {
    const blockchain = req.app.get('blockchain');
    res.json({
        result: "Success",
        message: "현재 채굴 난이도입니다.",
        difficulty: blockchain.miningDifficulty
    });
});

// PUT /mine/difficulty: 채굴 난이도를 설정합니다. (데모/테스트용)
router.put('/difficulty', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { newDifficulty } = req.body;

    const parsedDifficulty = parseInt(newDifficulty);

    if (isNaN(parsedDifficulty) || parsedDifficulty < 1 || parsedDifficulty > 64) { // SHA256 해시 길이에 따라 최대 64
        return res.status(400).json({
            result: "Fail",
            error: "유효한 채굴 난이도를 입력하세요 (1-64 사이의 숫자)."
        });
    }

    blockchain.miningDifficulty = parsedDifficulty;

    res.json({
        result: "Success",
        message: `채굴 난이도가 ${parsedDifficulty}로 설정되었습니다.`,
        newDifficulty: blockchain.miningDifficulty
    });
});


module.exports = router; // 라우터를 모듈로 내보냅니다.
