// Asset transport only: original Worker retains every auth/host/API check.
import worker from './worker.js';
import {inlineAssets} from './inline-assets.js';
export {Campaign,Registry} from './worker.js';
export default {fetch(request,env,ctx){return worker.fetch(request,{...env,ASSETS:inlineAssets},ctx)}};
