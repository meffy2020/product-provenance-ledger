const express = require('express'); // Express 프레임워크를 가져옵니다.
const Blockchain = require('./blockchain/blockchain'); // 핵심 로직인 Blockchain 클래스를 가져옵니다.

const app = express(); // Express 애플리케이션 인스턴스를 생성합니다.
const dlt = new Blockchain(); // DLT(분산 원장 기술)의 블록체인 인스턴스를 생성합니다. 이 인스턴스가 이 서버(노드)의 모든 상태를 관리합니다.

// `app.set`을 사용하여 블록체인 인스턴스를 Express 앱의 로컬 변수로 설정합니다.
// 이렇게 하면, 어떤 라우터에서든 `req.app.get('blockchain')` 코드로 동일한 블록체인 인스턴스에 접근할 수 있습니다.
app.set('blockchain', dlt);

// 미들웨어(Middleware) 설정
// POST 요청의 본문(body)에 포함된 JSON 형식의 데이터를 파싱(해석)하기 위해 필요합니다.
app.use(express.json());
// URL-encoded 형식의 데이터(주로 HTML 폼 데이터)를 파싱하기 위해 필요합니다.
app.use(express.urlencoded({ extended: false }));

// 루트 엔드포인트: API 서버가 살아있는지 확인하고, 현재 노드의 고유 주소를 보여줍니다.
app.get('/', (req, res) => {
    res.json({
        message: '분산 원장 기술(DLT) API에 오신 것을 환영합니다!',
        nodeAddress: dlt.nodeAddress
    });
});

// 핵심 엔드포인트: 현재 노드가 가진 블록체인의 전체 데이터를 외부에 제공합니다.
// 다른 노드들이 이 API를 호출하여 체인 정보를 동기화(합의)하는 데 사용됩니다.
app.get('/blockchain', (req, res) => {
    res.send(dlt);
});

// 각 기능별 라우터를 등록합니다.
app.use('/transactions', require('./routes/transactions')); // '/transactions' 경로의 요청은 transactions.js 파일에서 처리합니다.
app.use('/mine', require('./routes/mine')); // '/mine' 경로의 요청은 mine.js 파일에서 처리합니다.
app.use('/nodes', require('./routes/nodes')); // '/nodes' 경로의 요청은 nodes.js 파일에서 처리합니다.
app.use('/histories', require('./routes/histories')); // '/histories' 경로의 요청은 histories.js 파일에서 처리합니다.

module.exports = app; // 설정이 완료된 Express 앱 객체를 모듈로 내보냅니다. (index.js에서 사용)
