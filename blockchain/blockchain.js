const crypto = require('crypto'); // Node.js 내장 암호화 모듈
const { v4: uuidv4 } = require('uuid'); // 고유 ID 생성을 위한 uuid 라이브러리

class Blockchain {
    constructor() {
        // 전체 블록체인(모든 블록)을 저장하는 배열
        this.chain = []; 
        // 아직 블록에 포함되지 않은, 처리 대기 중인 트랜잭션 목록
        this.pendingTransactions = []; 
        // 현재 노드의 고유 주소. 서버가 시작될 때마다 새로 생성됩니다.
        this.nodeAddress = uuidv4().split('-').join('');
        // 현재 노드가 알고 있는 네트워크 상의 다른 노드들의 주소 목록
        this.networkNodes = []; 

        // 블록체인의 첫 번째 블록인 '제네시스 블록'을 생성합니다.
        this.createNewBlock(100, '0', '0'); // nonce=100, previousBlockHash='0', hash='0'은 임의의 값입니다.
    }

    /**
     * 새로운 블록을 생성하고 체인에 추가합니다.
     * @param {number} nonce - 작업 증명을 통해 찾은 nonce 값
     * @param {string} previousBlockHash - 이전 블록의 해시 값
     * @param {string} hash - 현재 블록의 해시 값
     * @returns {object} 생성된 새 블록 객체
     */
    createNewBlock(nonce, previousBlockHash, hash) {
        const newBlock = {
            index: this.chain.length + 1, // 블록 번호
            timestamp: Date.now(), // 생성 시간
            transactions: JSON.parse(JSON.stringify(this.pendingTransactions)), // 깊은 복사를 통해 트랜잭션의 불변성 확보
            nonce: nonce, // 작업 증명 숫자
            hash: hash, // 현재 블록의 데이터 해시 값
            previousBlockHash: previousBlockHash, // 이전 블록의 해시 값
        };

        this.pendingTransactions = []; // 처리 대기 중인 트랜잭션 목록을 비웁니다.
        this.chain.push(newBlock); // 체인에 새 블록을 추가합니다.

        return newBlock;
    }

    /**
     * 체인의 마지막 블록을 반환합니다.
     * @returns {object} 마지막 블록 객체
     */
    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    /**
     * 새로운 트랜잭션을 생성하여 '처리 대기 중인 트랜잭션' 목록에 추가합니다.
     * @param {string} sender - 발신자 주소
     * @param {string} recipient - 수신자 주소
     * @param {string} productId - 거래되는 상품의 ID
     * @returns {object} 생성된 새 트랜잭션 객체
     */
    createNewTransaction(sender, recipient, productId) {
        const newTransaction = {
            sender: sender,
            recipient: recipient,
            productId: productId,
            transactionId: uuidv4().split('-').join(''), // 각 트랜잭션의 고유 ID
            timestamp: Date.now()
        };

        this.pendingTransactions.push(newTransaction);

        return newTransaction;
    }

    /**
     * 블록 데이터를 입력받아 SHA-256 해시 값을 생성합니다.
     * `currentBlockData` 내의 트랜잭션 순서와 내용에 더욱 민감하게 반응하도록 해싱 방식을 수정합니다.
     * @param {string} previousBlockHash - 이전 블록의 해시
     * @param {object} currentBlockData - 현재 블록의 데이터 (트랜잭션 목록, 인덱스)
     * @param {number} nonce - Nonce 값
     * @returns {string} 생성된 해시 값 (64자리 16진수 문자열)
     */
    hashBlock(previousBlockHash, currentBlockData, nonce) {
        // 트랜잭션 배열과 인덱스를 명시적으로 문자열화하여 순서와 내용의 일관성을 확보합니다.
        const transactionsAsString = JSON.stringify(currentBlockData.transactions);
        const indexAsString = currentBlockData.index.toString();
        
        // 모든 데이터를 문자열로 변환하여 합칩니다.
        const dataAsString = previousBlockHash + nonce.toString() + transactionsAsString + indexAsString;
        
        // SHA-256 알고리즘으로 해싱합니다.
        const hash = crypto.createHash('sha256').update(dataAsString).digest('hex');
        return hash;
    }

    /**
     * 간단한 작업 증명(Proof of Work) 알고리즘입니다. (비동기 처리)
     * 해시 값이 '0000'으로 시작하도록 만드는 nonce 값을 찾습니다.
     * 이 과정은 CPU 집약적이므로, 이벤트 루프를 막지 않기 위해 비동기로 처리합니다.
     * @param {string} previousBlockHash - 이전 블록의 해시
     * @param {object} currentBlockData - 현재 블록의 데이터
     * @returns {Promise<number>} 찾아낸 Nonce 값을 담은 Promise
     */
    async proofOfWork(previousBlockHash, currentBlockData) {
        let nonce = 0;
        let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        // 해시 값이 '0000'으로 시작하지 않으면 nonce를 1 증가시키고 해시를 다시 계산합니다.
        while (hash.substring(0, 4) !== '0000') {
            // CPU 집약적인 루프 중간에 제어권을 이벤트 루프에 넘겨 다른 작업을 처리할 수 있게 합니다.
            await new Promise(resolve => setImmediate(resolve));
            nonce++;
            hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        }
        return nonce; // 조건에 맞는 nonce 값을 반환합니다.
    }

    /**
     * 주어진 블록체인이 유효한지 검증합니다. (수정된 로직)
     * 블록체인의 모든 블록이 이전 블록과 올바르게 연결되어 있고, 각 블록의 해시값이 위변조되지 않았는지 확인합니다.
     * @param {Array<object>} blockchain - 검증할 블록체인 배열
     * @returns {boolean} 유효하면 true, 그렇지 않으면 false
     */
    chainIsValid(blockchain) {
        // 1. 제네시스 블록이 올바른지 검증합니다.
        const genesisBlock = blockchain[0];
        if (
            genesisBlock.nonce !== 100 ||
            genesisBlock.previousBlockHash !== '0' ||
            genesisBlock.hash !== '0' ||
            genesisBlock.transactions.length !== 0
        ) {
            return false;
        }

        // 2. 체인의 나머지 블록들을 순회하며 검증합니다.
        for (let i = 1; i < blockchain.length; i++) {
            const currentBlock = blockchain[i];
            const prevBlock = blockchain[i - 1];

            // 2-1. 현재 블록의 데이터를 사용하여 해시를 재계산합니다.
            const recalculatedHash = this.hashBlock(
                prevBlock.hash, // 이전 블록의 '검증된' 해시를 사용합니다.
                { transactions: currentBlock.transactions, index: currentBlock.index },
                currentBlock.nonce
            );

            // 2-2. 재계산된 해시가 현재 블록에 저장된 해시와 일치하는지 확인합니다.
            if (currentBlock.hash !== recalculatedHash) {
                return false; // 블록 데이터가 조작되었습니다.
            }

            // 2-3. 현재 블록의 previousBlockHash가 이전 블록의 해시와 일치하는지 확인합니다.
            if (currentBlock.previousBlockHash !== prevBlock.hash) {
                return false; // 체인 링크가 끊어졌습니다.
            }
        }

        // 모든 검증을 통과하면 유효한 체인입니다.
        return true;
    }
}

module.exports = Blockchain;
