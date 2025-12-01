// app.js에서 설정된 Express 애플리케이션을 가져옵니다.
const app = require('./app');

// 서버가 실행될 포트를 지정합니다.
// 환경 변수(process.env.PORT)에 포트가 지정되어 있으면 그 값을 사용하고,
// 그렇지 않으면 기본값으로 3000번 포트를 사용합니다.
const PORT = process.env.PORT || 3000;

// 지정된 포트에서 서버를 시작하고, 클라이언트의 요청을 수신 대기합니다.
// 서버가 성공적으로 시작되면 콘솔에 메시지를 출력합니다.
app.listen(PORT, () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
