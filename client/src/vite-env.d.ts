// client/src/vite-env.d.ts
/// <reference types="vite/client" />

interface Window {
  // 구글 맵 객체는 동적으로 로드되므로 any 타입을 허용
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  google: any;
}

// declare var google; <--- 이 부분은 삭제했습니다. (window.google 사용하므로 불필요)
