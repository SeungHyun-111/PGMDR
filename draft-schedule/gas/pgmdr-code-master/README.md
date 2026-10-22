# PGMDR 전용 편성코드 DB 갱신 GAS

현재 PGMDR는 지정된 임시 계정으로 Culture Firebase에 자동 로그인하고, 기존 Culture GAS의 `codeMasterRows` 응답을 브라우저에서 DB에 저장합니다. 따라서 아래 별도 GAS는 현재 사용하지 않는 대안입니다. 현재 방식에서는 새 GAS URL로 교체하지 않습니다.

일반 사용자는 관리자 로그인 없이 PGMDR의 업데이트 버튼을 누릅니다.
GAS는 배포 소유자의 Google OAuth 토큰으로 고정된 `cultureCodeMaster` 경로만 갱신합니다.
Culture의 기존 GAS와 RTDB 규칙은 변경하지 않습니다. 같은 DB이므로 갱신된 목록은 Culture에도 반영됩니다.

## 새 GAS 배포

1. 원본 시트를 읽을 수 있고 `broadcast-schedule-6c97d` 프로젝트의 Realtime Database 쓰기 권한이 있는 Google 계정으로 별도 Apps Script 프로젝트를 만듭니다. Google Cloud IAM의 Firebase Realtime Database Admin 역할(`roles/firebasedatabase.admin`) 등 해당 권한이 필요합니다. 웹 사용자에게 이 권한을 주는 것은 아닙니다.
2. `Code.gs`를 복사합니다. 프로젝트 설정에서 매니페스트 표시를 켜고 `appsscript.json`도 복사합니다.
3. 편집기에서 `pgmdrCodeMasterRefresh`를 한 번 실행하고 소유자 권한을 승인합니다. 이 실행은 실제 공유 편성코드 DB를 갱신합니다. 실행 결과/오류를 확인합니다.
4. 새 배포 → 웹 앱 → 실행 사용자 **나(배포자)** → 액세스 **모든 사용자**로 배포합니다.
5. 새 `/exec` URL을 PGMDR 환경변수에 지정합니다.

```dotenv
VITE_CULTURE_CODE_MASTER_REFRESH_URL=https://script.google.com/macros/s/새로운_배포_ID/exec
```

6. 로컬 개발 서버를 재시작하고, 운영 사이트는 환경변수 설정 후 다시 빌드/배포합니다.
7. PGMDR의 편성코드 DB 업데이트 버튼으로 완료 알림과 자동완성 목록을 확인합니다.

기존 PGMDR 클라이언트는 `action=refresh` 호출 후 RTDB의 `updatedAt` 변경을 확인하므로 코드 변경 없이 호환됩니다. 새 URL 설정 전까지는 기존 Culture GAS를 호출합니다.

공개 엔드포인트는 원본 시트 → 지정 DB 경로 갱신만 허용합니다. 호출자가 임의 데이터·경로·토큰을 넘길 수 없으며, 빈 목록은 저장하지 않습니다. 동시 요청은 잠금으로 중복 실행을 막습니다.

참고: https://firebase.google.com/docs/database/rest/auth
