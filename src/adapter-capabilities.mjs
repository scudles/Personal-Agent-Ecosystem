// Capability descriptions are declarative. This module never imports or invokes native SDK/UI adapters.
export const adapterCapabilities=Object.freeze({
 hermes:{identityEvidence:'Gateway session_id/stored_session_id/title',existingTransport:'native/hermes-v2.py + existing Gateway SDK',readEvidence:'gateway_transcript',limits:['existing SDK profile/version dependency','provider currently pinned to original session; general native binding activation not authorized'],realVerifiedThisRun:false},
 deepseek:{identityEvidence:'bound desktop title + fixed original persisted session log',existingTransport:'native/DesktopSession.cs + dsh-observe.mjs',readEvidence:'persisted_session_events',limits:['interactive unlocked desktop','draft and human input veto writes','UIA application/version dependence','general native binding activation not authorized'],realVerifiedThisRun:false},
 chatgpt:{identityEvidence:'prior existing-session binding + visible UI title/prompt boundaries',existingTransport:'native/DesktopSession.cs',readEvidence:'visible_uia',limits:['visible conversation window required for passive reading','cannot prove invisible model routing or complete server-side history','focus/draft/lock protection','general native binding activation not authorized'],realVerifiedThisRun:false}
});
export class LockedRealAdapter{
 async inspect(){throw Error('real_adapters_not_authorized');}async send(){throw Error('real_adapters_not_authorized');}async read(){throw Error('real_adapters_not_authorized');}async latestAction(){throw Error('real_adapters_not_authorized');}async passive(){throw Error('real_adapters_not_authorized');}
}
export const communicationMethods=Object.freeze(['connect','inspectSession','sendMessage','receiveMessages','getDeliveryStatus','pause','resume','healthCheck','disconnect']);
for(const method of communicationMethods)LockedRealAdapter.prototype[method]=async function(){return{supported:false,authorized:false,reason:'real_adapters_not_authorized',nativeAccessed:false};};
// A communication facade only: no runtime, memory, prompt or model configuration interface.
export class SimulationCommunicationAdapter{
 constructor(adapter){if(adapter.mode!=='SIMULATION_ONLY')throw Error('simulation_adapter_required');this.adapter=adapter;this.mode='SIMULATION_ONLY';}
 async connect(role,ctx){return this.inspectSession(role,ctx);}
 async inspectSession(role,ctx){return this.adapter.inspect(role,{context:ctx});}
 async sendMessage(role,delivery,baseline){return this.adapter.send(role,delivery,baseline);}
 async receiveMessages(role,delivery){return this.adapter.read(role,delivery);}
 async getDeliveryStatus(role,id,ctx){const w=this.adapter.w,d=w.owned(ctx,'delivery',id);if(d.role!==role)throw Error('delivery_recipient_mismatch');return{state:d.state,simulation:true};}
 async pause(role,ctx){const w=this.adapter.w;if(w.binding(ctx,role)?.kind!=='simulated')throw Error('real_adapter_hard_locked');w.pauseBinding(ctx,role,true);return{paused:true,simulation:true};}
 async resume(role,ctx){const w=this.adapter.w;if(w.binding(ctx,role)?.kind!=='simulated')throw Error('real_adapter_hard_locked');w.pauseBinding(ctx,role,false);return{paused:false,simulation:true};}
 async healthCheck(role,ctx){const result=await this.inspectSession(role,ctx);return{...result,connected:!result.error,simulation:true};}
 async disconnect(role,ctx){return this.pause(role,ctx);}
}