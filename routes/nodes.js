const express = require('express'); // Express 프레임워크를 가져옵니다.
const router = express.Router(); // Express 라우터 인스턴스를 생성합니다.
const axios = require('axios'); // 다른 노드와 HTTP 통신을 하기 위해 axios를 사용합니다.

// 이 라우터는 app.js에서 설정한 블록체인 인스턴스에 접근합니다.

// API 1: 새로운 노드를 네트워크에 등록하고, 이 사실을 다른 모든 노드에게 전파(broadcast)합니다.
router.post('/register-and-broadcast-node', async (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { newNodeUrl } = req.body; // 요청 본문에서 새로 참여할 노드의 URL을 가져옵니다.

    // 1. 현재 노드의 네트워크 노드 목록에 새 노드의 URL을 추가합니다. (이미 존재하거나 자기 자신이면 추가하지 않음)
    if (blockchain.networkNodes.indexOf(newNodeUrl) === -1 && blockchain.nodeAddress !== newNodeUrl) {
        blockchain.networkNodes.push(newNodeUrl);
    }

    // 2. 현재 네트워크에 이미 존재하는 다른 모든 노드에게 새 노드가 등록되었음을 알립니다.
    const registrationPromises = [];
    blockchain.networkNodes.forEach(networkNodeUrl => {
        // 각 노드의 '/nodes/register-node' API를 호출하는 비동기 요청을 생성합니다.
        const requestOptions = {
            method: 'post',
            url: `${networkNodeUrl}/nodes/register-node`,
            data: { newNodeUrl: newNodeUrl }
        };
        registrationPromises.push(axios(requestOptions));
    });

    try {
        // 3. 모든 노드에게 알리는 요청이 끝날 때까지 기다립니다.
        await Promise.all(registrationPromises);

        // 4. 새로 등록된 노드에게, 기존 네트워크에 있던 모든 노드들의 정보를 한 번에 알려줍니다.
        const bulkRegisterOptions = {
            method: 'post',
            url: `${newNodeUrl}/nodes/register-nodes-bulk`,
            data: { allNetworkNodes: [...blockchain.networkNodes, blockchain.nodeAddress] }
        };
        await axios(bulkRegisterOptions);
        
        res.json({ result: "Success", message: '새로운 노드가 성공적으로 네트워크에 등록 및 전파되었습니다.' });
    } catch (error) {
        // 전파 과정 중 하나라도 실패하면 오류를 반환합니다.
        res.status(500).json({ result: "Fail", error: '노드 등록 전파에 실패했습니다.' });
    }
});

// API 2: 다른 노드로부터 새 노드의 정보를 받아서 내 노드 목록에 등록만 합니다. (전파 기능 없음)
router.post('/register-node', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { newNodeUrl } = req.body; // 등록할 새 노드의 URL

    const nodeNotAlreadyPresent = blockchain.networkNodes.indexOf(newNodeUrl) === -1;
    const notCurrentNode = blockchain.nodeAddress !== newNodeUrl;

    // 노드 목록에 없고, 자기 자신이 아닐 경우에만 추가합니다.
    if (nodeNotAlreadyPresent && notCurrentNode) {
        blockchain.networkNodes.push(newNodeUrl);
    }
    
    res.json({ result: "Success", message: '새로운 노드가 성공적으로 등록되었습니다.' });
});

// API 3: 네트워크에 처음 참여하는 노드가 기존 노드들의 목록 전체를 받아서 한 번에 등록합니다.
router.post('/register-nodes-bulk', (req, res) => {
    const blockchain = req.app.get('blockchain');
    const { allNetworkNodes } = req.body; // 기존 모든 노드의 URL 목록

    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = blockchain.networkNodes.indexOf(networkNodeUrl) === -1;
        const notCurrentNode = blockchain.nodeAddress !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) {
            blockchain.networkNodes.push(networkNodeUrl);
        }
    });

    res.json({ result: "Success", message: '기존 노드 목록을 성공적으로 등록했습니다.' });
});


// API 4: 합의(Consensus) 알고리즘 - "가장 긴 체인 규칙(Longest Chain Rule)"을 구현합니다.
// 네트워크 상에서 가장 긴 유효한 체인을 찾아, 자신의 체인을 그것으로 교체하여 데이터 동기화를 이룹니다.
router.get('/consensus', async (req, res) => {
    const blockchain = req.app.get('blockchain');
    const requestPromises = [];

    // 1. 네트워크의 모든 다른 노드에게 그들의 블록체인 정보를 요청합니다.
    blockchain.networkNodes.forEach(networkNodeUrl => {
        requestPromises.push(axios.get(`${networkNodeUrl}/blockchain`));
    });

    try {
        // 2. 모든 노드로부터 응답을 받을 때까지 기다립니다.
        const blockchains = await Promise.all(requestPromises);
        let maxChainLength = blockchain.chain.length;
        let newLongestChain = null;
        let newPendingTransactions = null;

        // 3. 받은 모든 블록체인 중에서 가장 긴 유효한 체인을 찾습니다.
        for (const response of blockchains) {
            const remoteChain = response.data.chain;
            // 현재 내 체인보다 길고, 유효성 검증을 통과한 체인인지 확인합니다.
            if (remoteChain.length > maxChainLength && blockchain.chainIsValid(remoteChain)) {
                maxChainLength = remoteChain.length;
                newLongestChain = remoteChain;
                newPendingTransactions = response.data.pendingTransactions;
            }
        }

        // 4. 더 긴 유효한 체인을 찾았다면, 내 체인을 그것으로 교체합니다.
        if (!newLongestChain || (newLongestChain && !blockchain.chainIsValid(newLongestChain))) {
            res.json({
                result: "Success",
                message: '현재 체인이 가장 최신 버전이므로 교체되지 않았습니다.',
                chain: blockchain.chain
            });
        } else {
            blockchain.chain = newLongestChain;
            blockchain.pendingTransactions = newPendingTransactions;
            res.json({
                result: "Success",
                message: '더 긴 유효 체인을 발견하여 현재 체인을 교체했습니다.',
                chain: blockchain.chain
            });
        }
    } catch (error) {
        res.status(500).json({ result: "Fail", error: '합의 과정에 실패했습니다.' });
    }
});


module.exports = router; // 라우터를 모듈로 내보냅니다.
