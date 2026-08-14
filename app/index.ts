/* 진입점. Expo가 package.json의 "main"으로 이 파일을 찾는다.
   registerRootComponent는 AppRegistry.registerComponent를 부르면서
   네이티브가 기대하는 이름("main")으로 등록해준다 — 직접 등록하면
   이름이 어긋나서 앱이 흰 화면으로 뜬다. */
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
