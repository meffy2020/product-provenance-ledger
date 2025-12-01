const request = require('supertest');
const app = require('../app');
const axios = require('axios');

jest.mock('axios'); // axios 모듈을 모킹합니다.

describe('Nodes API', () => {
    let blockchain;
    const testNodeUrl1 = 'http://localhost:3001';
    const testNodeUrl2 = 'http://localhost:3002';

    beforeEach(() => {
        blockchain = app.get('blockchain');
        blockchain.chain = [];
        blockchain.pendingTransactions = [];
        blockchain.networkNodes = [];
        blockchain.createNewBlock(100, '0', '0'); // Genesis Block
        jest.clearAllMocks(); // 모든 모의(mock) 함수들의 호출 기록을 초기화합니다.
        blockchain.nodeAddress = 'test-node-address'; // 현재 노드 주소 설정 (자기 자신을 등록하지 않도록)
    });

    // POST /nodes/register-and-broadcast-node
    it('POST /register-and-broadcast-node: 새로운 노드를 등록하고 네트워크에 브로드캐스트해야 합니다.', async () => {
        // 다른 노드들에게 등록 요청을 보낼 때 성공 응답을 모킹합니다.
        axios.post.mockResolvedValue({ status: 200 });

        const res = await request(app)
            .post('/nodes/register-and-broadcast-node')
            .send({ newNodeUrl: testNodeUrl1 });

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('새로운 노드가 성공적으로 네트워크에 등록 및 전파되었습니다.');
        expect(blockchain.networkNodes).toContain(testNodeUrl1);
        
        // axios.post가 호출되었는지 확인 (self-node, newNodeUrl 제외한 모든 networkNodes에)
        // beforeEach에서 networkNodes가 비어있으므로, newNodeUrl 자신은 제외하고 0번 호출
        // 그러나 register-and-broadcast-node는 먼저 networkNodes에 newNodeUrl을 추가한 뒤, 
        // 그 목록을 순회하며 '나 자신'이 아닌 노드에 브로드캐스트하므로,
        // 이 테스트의 경우 networkNodes에는 testNodeUrl1이 포함되어 있으나,
        // broadcast 대상에서는 testNodeUrl1 자신이 빠지므로, axios.post는 호출되지 않아야 합니다.
        // 하지만 실제 구현에서는 networkNodes를 포함한 목록 자체를 broadcast 대상으로 삼고 있으므로,
        // 자기 자신(testNodeUrl1)은 register-node를 통해 등록되므로 axios.post는 해당 노드에 대해 호출되지 않아야 합니다.
        // 다만, register-and-broadcast-node에서 networkNodes를 순회하면서 본인에게 요청을 보내지 않도록 필터링하고 있습니다.
        // 이 테스트에서는 아직 networkNodes에 testNodeUrl1 외 다른 노드가 없으므로 axios.post는 호출되지 않습니다.

        // bulkRegisterOptions에 대한 axios 호출 (새 노드에게 기존 노드 목록 전달)
        expect(axios).toHaveBeenCalledWith(expect.objectContaining({
            url: `${testNodeUrl1}/nodes/register-nodes-bulk`,
            data: { allNetworkNodes: [testNodeUrl1, 'test-node-address'] }
        }));
    });

    it('POST /register-and-broadcast-node: 유효하지 않은 URL로 요청 시 오류를 반환해야 합니다.', async () => {
        // axios 호출이 오류를 발생시키도록 모킹합니다.
        axios.mockRejectedValue(new Error('Network error or invalid URL')); // axios 기본 함수 모킹

        const res = await request(app)
            .post('/nodes/register-and-broadcast-node')
            .send({ newNodeUrl: 'http://invalid-url:9999' }); // 유효하지 않은 URL
        
        expect(res.statusCode).toEqual(500); // axios 호출이 실패했으므로 500 예상
        expect(res.body.result).toBe('Fail');
        expect(res.body.error).toContain('노드 등록 전파에 실패했습니다.');
    });


    // POST /nodes/register-node
    it('POST /register-node: 새로운 노드를 성공적으로 등록해야 합니다.', async () => {
        const res = await request(app)
            .post('/nodes/register-node')
            .send({ newNodeUrl: testNodeUrl1 });

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('새로운 노드가 성공적으로 등록되었습니다.');
        expect(blockchain.networkNodes).toContain(testNodeUrl1);
    });

    it('POST /register-node: 이미 등록된 노드를 다시 등록하지 않아야 합니다.', async () => {
        blockchain.networkNodes.push(testNodeUrl1); // 미리 등록
        const initialNodesCount = blockchain.networkNodes.length;

        const res = await request(app)
            .post('/nodes/register-node')
            .send({ newNodeUrl: testNodeUrl1 });

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(blockchain.networkNodes).toHaveLength(initialNodesCount); // 개수 변화 없어야 함
    });

    // POST /nodes/register-nodes-bulk
    it('POST /register-nodes-bulk: 여러 노드를 한 번에 성공적으로 등록해야 합니다.', async () => {
        const initialNodesCount = blockchain.networkNodes.length; // 0

        const res = await request(app)
            .post('/nodes/register-nodes-bulk')
            .send({ allNetworkNodes: [testNodeUrl1, testNodeUrl2] });

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('기존 노드 목록을 성공적으로 등록했습니다.');
        expect(blockchain.networkNodes).toContain(testNodeUrl1);
        expect(blockchain.networkNodes).toContain(testNodeUrl2);
        expect(blockchain.networkNodes.length).toBe(initialNodesCount + 2);
    });

    it('POST /register-nodes-bulk: 자신 노드는 등록하지 않아야 합니다.', async () => {
        blockchain.networkNodes.push(testNodeUrl1); // 다른 노드 하나 미리 등록
        const initialNodesCount = blockchain.networkNodes.length; // 1

        const res = await request(app)
            .post('/nodes/register-nodes-bulk')
            .send({ allNetworkNodes: [blockchain.nodeAddress, testNodeUrl2] }); // 자기 자신 포함

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(blockchain.networkNodes).not.toContain(blockchain.nodeAddress); // 자기 자신은 포함되면 안 됨
        expect(blockchain.networkNodes).toContain(testNodeUrl2);
        expect(blockchain.networkNodes.length).toBe(initialNodesCount + 1); // 자기 자신 제외하고 1개만 추가됨
    });

    // GET /nodes/consensus
    it('GET /nodes/consensus: 더 긴 유효 체인이 있으면 자신의 체인을 교체해야 합니다.', async () => {
        // 현재 노드에 2개의 블록 추가
        blockchain.createNewTransaction('a', 'b', 'c');
        await request(app).post('/mine').send({ minerAddress: 'miner' });

        // 다른 노드가 더 긴 체인을 가지고 있다고 모킹합니다. (3개 블록)
        const longerChain = JSON.parse(JSON.stringify(blockchain.chain));
        longerChain.push(blockchain.createNewBlock(123, longerChain[longerChain.length-1].hash, 'new_hash_3')); // 가상의 세 번째 블록
        blockchain.chain.pop(); // createNewBlock으로 추가된 블록 제거

        axios.get.mockResolvedValueOnce({ // 첫 번째 호출 (testNodeUrl1의 /blockchain)
            data: {
                chain: longerChain,
                pendingTransactions: []
            }
        });
        axios.get.mockResolvedValueOnce({ // 두 번째 호출 (testNodeUrl2의 /blockchain)
            data: {
                chain: blockchain.chain, // 짧은 체인
                pendingTransactions: []
            }
        });

        blockchain.networkNodes.push(testNodeUrl1, testNodeUrl2);
        // chainIsValid가 제대로 동작한다고 가정하고 모킹 (컨센서스 로직 테스트 위함)
        jest.spyOn(blockchain, 'chainIsValid').mockReturnValue(true);

        const res = await request(app).get('/nodes/consensus');
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('더 긴 유효 체인을 발견하여 현재 체인을 교체했습니다.');
        expect(blockchain.chain.length).toBe(3); // 체인이 교체되었는지 확인
    });

    it('GET /nodes/consensus: 더 긴 유효 체인이 없으면 자신의 체인을 교체하지 않아야 합니다.', async () => {
        // 현재 노드에 2개의 블록 추가
        blockchain.createNewTransaction('a', 'b', 'c');
        await request(app).post('/mine').send({ minerAddress: 'miner' });

        // 다른 노드가 더 짧거나 같은 길이의 체인을 가지고 있다고 모킹합니다.
        axios.get.mockResolvedValueOnce({
            data: {
                chain: [blockchain.chain[0]], // 짧은 체인
                pendingTransactions: []
            }
        });
        axios.get.mockResolvedValueOnce({
            data: {
                chain: blockchain.chain, // 같은 길이의 체인
                pendingTransactions: []
            }
        });

        blockchain.networkNodes.push(testNodeUrl1, testNodeUrl2);
        jest.spyOn(blockchain, 'chainIsValid').mockReturnValue(true);

        const res = await request(app).get('/nodes/consensus');
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('현재 체인이 가장 최신 버전이므로 교체되지 않았습니다.');
        expect(blockchain.chain.length).toBe(2); // 체인이 교체되지 않았는지 확인
    });

    // GET /nodes
    it('GET /nodes: 현재 등록된 모든 네트워크 노드의 목록을 반환해야 합니다.', async () => {
        blockchain.networkNodes.push(testNodeUrl1, testNodeUrl2);
        const res = await request(app).get('/nodes');

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('현재 등록된 네트워크 노드 목록입니다.');
        expect(res.body.networkNodes).toEqual([testNodeUrl1, testNodeUrl2]);
    });

    it('GET /nodes: 등록된 노드가 없으면 빈 배열을 반환해야 합니다.', async () => {
        const res = await request(app).get('/nodes');

        expect(res.statusCode).toEqual(200);
        expect(res.body.result).toBe('Success');
        expect(res.body.message).toContain('현재 등록된 네트워크 노드 목록입니다.');
        expect(res.body.networkNodes).toEqual([]);
    });
});