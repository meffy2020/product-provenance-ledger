# WSD2 Project: 나만의 맛집 지도 및 번개 모임 플랫폼

**팀명:** {여기에 팀명을 입력하세요}  
**팀원:** {여기에 팀원 이름을 입력하세요}  
**제출일:** 2025년 11월 24일

## 1. 프로젝트 개요

이 프로젝트는 사용자들이 자신만의 맛집 지도를 만들고 리뷰를 공유하며, 즉흥적인 식사 모임(번개)을 주선하고 참여할 수 있는 **소셜 다이닝(Social Dining) 플랫폼**입니다.

사용자는 맛집에 대한 리뷰를 작성하여 다른 사람들과 공유하고, 관심 있는 사용자를 팔로우하여 그들의 활동을 피드로 받아볼 수 있습니다. 또한, "오늘 저녁 OOO에서 같이 드실 분?"과 같은 번개 모임을 직접 주최하거나 다른 사람의 모임에 참여하여 새로운 사람들과 교류할 수 있습니다. 이를 통해 단순한 맛집 정보 공유를 넘어, 취향이 맞는 사람들 간의 실제적인 연결과 소통을 촉진하는 것을 목표로 합니다.

## 2. API 설계

### 2.1. User 라우터

-   **API:** 회원 가입
-   **Request:** `POST /users/add`
-   **Request Body:**
    ```json
    {
      "userId": "testuser",
      "password": "password123",
      "name": "테스트유저"
    }
    ```
-   **Success Response (201):**
    ```json
    {
      "result": "Success",
      "message": "회원 가입이 완료되었습니다."
    }
    ```
-   **Fail Response (409):**
    ```json
    {
      "result": "Fail",
      "error": "이미 등록된 사용자 아이디입니다."
    }
    ```

### 2.2. Review 라우터

-   **API:** 맛집 리뷰 작성
-   **Request:** `POST /reviews` (※ JWT 인증 필요)
-   **Request Body:**
    ```json
    {
      "restaurantName": "토끼정",
      "address": "서울시 강남구",
      "content": "크림 카레우동이 정말 맛있어요!",
      "rating": 5
    }
    ```
-   **Success Response (201):**
    ```json
    {
      "result": "Success",
      "review": {
        "_id": "6560...",
        "restaurantName": "토끼정",
        "content": "크림 카레우동이 정말 맛있어요!",
        "rating": 5,
        "author": "...",
        "createdAt": "..."
      }
    }
    ```

### 2.3. Meetup 라우터

-   **API:** 번개 모임 참여
-   **Request:** `POST /meetups/:meetupId/join` (※ JWT 인증 필요)
-   **Success Response (200):**
    ```json
    {
      "result": "Success",
      "message": "모임에 참여했습니다.",
      "meetup": {
        "_id": "...",
        "title": "저녁 드실 분",
        "attendees": ["...", "..."]
      }
    }
    ```
-   **Fail Response (400):**
    ```json
    {
      "result": "Fail",
      "error": "모임 정원이 가득 찼습니다."
    }
    ```

### 2.4. Comment 라우터

-   **API:** 맛집 리뷰에 댓글 작성
-   **Request:** `POST /reviews/:reviewId/comments` (※ JWT 인증 필요)
-   **Request Body:**
    ```json
    {
      "content": "저도 여기 가보고 싶어요!"
    }
    ```
-   **Success Response (201):**
    ```json
    {
      "result": "Success",
      "comment": {
        "_id": "...",
        "content": "저도 여기 가보고 싶어요!",
        "author": "...",
        "parentId": "..."
      }
    }
    ```

### 2.5. Follow 라우터

-   **API:** 다른 사용자 팔로우
-   **Request:** `POST /follow/:userId` (※ JWT 인증 필요)
-   **Success Response (200):**
    ```json
    {
      "result": "Success",
      "message": "User B님을 팔로우했습니다."
    }
    ```
-   **Fail Response (400):**
    ```json
    {
      "result": "Fail",
      "error": "자기 자신을 팔로우할 수 없습니다."
    }
    ```

## 3. 라우터 별 핵심 API 코드

### 3.1. Review 라우터의 '맛집 리뷰 작성' API

```javascript
// routes/reviews.js
router.post('/', auth, async (req, res) => {
    try {
        const { restaurantName, address, content, rating } = req.body;
        const review = new Review({
            restaurantName,
            address,
            content,
            rating,
            author: req.user._id
        });
        await review.save();
        res.status(201).json({ result: "Success", review });
    } catch (error) {
        res.status(400).json({ result: "Fail", error: error.message });
    }
});
```

-   **코드 간단 설명:** 인증 미들웨어(`auth`)를 통과한 사용자의 요청(`req`)에서 `restaurantName`, `rating` 등의 정보를 받아 `Review` 모델의 새로운 인스턴스를 생성합니다. `author` 필드에는 인증된 사용자의 ID를 저장한 후, 데이터베이스에 저장하고 성공 결과를 반환합니다.

### 3.2. Meetup 라우터의 '번개 모임 참여' API

```javascript
// routes/meetups.js
router.post('/:meetupId/join', auth, async (req, res) => {
    try {
        const meetup = await Meetup.findById(req.params.meetupId);
        // ... (모임 존재 여부, 모집 상태, 정원 등 예외 처리) ...
        if (meetup.attendees.includes(req.user._id)) {
            return res.status(400).json({ result: "Fail", error: "이미 참여한 모임입니다." });
        }
        meetup.attendees.push(req.user._id);
        await meetup.save();
        res.json({ result: "Success", message: "모임에 참여했습니다.", meetup });
    } catch (error) {
        res.status(500).json({ result: "Fail", error: error.message });
    }
});
```

-   **코드 간단 설명:** 참여하려는 모임(`meetup`)을 ID로 찾은 후, 이미 참여한 사용자인지, 정원이 가득 찼는지 등을 검사합니다. 모든 조건을 통과하면 `attendees` 배열에 현재 사용자의 ID를 추가하고 변경사항을 저장합니다.

## 4. 라우터 별 핵심 API 테스트 코드 및 그 결과

### 4.1. Review 라우터의 '맛집 리뷰 작성' API 테스트

```javascript
// tests/reviews.test.js
describe('POST /reviews (리뷰 생성)', () => {
    it('인증된 사용자는 새로운 리뷰를 성공적으로 작성해야 합니다.', async () => {
        const res = await request(app)
            .post('/reviews')
            .set('Authorization', `Bearer ${userToken}`) // 인증 토큰 포함
            .send(testReviewData);

        expect(res.statusCode).toEqual(201); // 201 Created 상태 코드인지 확인
        expect(res.body.result).toBe('Success'); // 응답 결과가 'Success'인지 확인
        expect(res.body.review.restaurantName).toBe(testReviewData.restaurantName);
    });
});
```

-   **테스트 결과 설명:** 위 코드는 `supertest` 라이브러리를 사용하여 API에 `POST` 요청을 보냅니다. `expect` 구문을 통해 HTTP 응답 코드가 `201`, 응답 본문의 `result`가 `Success`인지 검증함으로써 API가 성공적으로 동작했음을 확인합니다.

### 4.2. Meetup 라우터의 '번개 모임 참여' API 테스트

```javascript
// tests/meetups.test.js
describe('POST /meetups/:meetupId/join (모임 참여)', () => {
    it('다른 사용자가 성공적으로 모임에 참여해야 합니다.', async () => {
        // 'organizer'가 생성한 'meetup'에 'participant'가 참여하는 상황
        const res = await request(app)
            .post(`/meetups/${meetup._id}/join`)
            .set('Authorization', `Bearer ${participantToken}`);

        expect(res.statusCode).toEqual(200); // 200 OK 상태 코드인지 확인
        expect(res.body.result).toBe('Success');
        expect(res.body.meetup.attendees).toHaveLength(2); // 참여자 수가 2명인지 확인
    });
});
```

-   **테스트 결과 설명:** 모임 주최자(organizer)가 아닌 다른 사용자(participant)의 인증 토큰으로 참여 API를 호출합니다. `expect` 구문을 통해 요청이 성공하고(`200 OK`), 모임의 `attendees` 배열 길이가 2로 늘어났는지 검증하여 참여 기능이 정상 동작함을 확인합니다.

## 5. 부록. 프로젝트 수행 인증 사진

-   **대면 회의 사진 필수 (얼굴이 나오지 않은 학우는 인정 불가)**

{여기에 대면 회의 사진을 삽입하세요. 사진 파일이 있다면 보고서 문서에 이미지를 추가하시면 됩니다.}