/**
 * 세션 없는 방문자를 기본 관리자로 들여보내는 자동 로그인 스위치.
 * 켜 두면 주소를 아는 누구나 관리자 권한을 얻으므로 기본값은 꺼짐이다.
 * 시연용으로 따로 둔 DB에서만 DEMO_AUTO_LOGIN=true 로 켠다.
 */
export function autoLoginEnabled(): boolean {
  return process.env.DEMO_AUTO_LOGIN === 'true';
}
