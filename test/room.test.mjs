import test from'node:test';import assert from'node:assert/strict';import{Workflow,PINNED}from'../src/workflow.mjs';import{mentionTargets,readable,roomSnapshot,RoomMirror}from'../src/room.mjs';
const fixture=()=>{const w=new Workflow(':memory:');w.control({paused:false});return w;};
test('@ routing selects only the named original agents and never silently broadcasts',()=>{
 assert.deepEqual(mentionTargets('@Hermes 请回答'),['hermes']);assert.deepEqual(mentionTargets('@DeepSeek @ChatGPT 请分别回答'),['deepseek','chatgpt']);assert.equal(mentionTargets('@全部 核对').length,3);assert.throws(()=>mentionTargets('未指定接收方'));assert.throws(()=>mentionTargets('@HermesOther 请回答'));assert.throws(()=>mentionTargets('测试',['stranger']));
});
test('natural direct chat accepts ordinary replies without interpreting them as approvals',()=>{
 const w=fixture();const i=w.createChat({text:'@Hermes 虚构算式2+3=5，请用自然中文回答',targets:['hermes']});const d=w.claim('hermes');assert.ok(d.prompt.includes('\n'));assert.ok(!d.prompt.includes('"expected"'));assert.ok(!d.prompt.includes('TRB_ACTION'));
 w.sending('hermes',d.id,d.lease,{sessionId:PINNED.hermes.id,busy:false,draft:false});w.sent('hermes',d.id,d.lease,'fixture');
 const text='算式正确，2 加 3 等于 5。';w.receive('hermes',d.id,d.lease,text,{sessionId:PINNED.hermes.id,sourceUserId:'fixture',replyId:'natural-fixture',promptText:d.prompt,completed:true,noToolCalls:true});
 assert.equal(w.get('case',i.id).state,'chat_replied');const room=roomSnapshot(w);assert.equal(room.messages.length,2);assert.equal(room.messages[1].text,text);assert.equal(w.get('case',i.id).votes.hermes,undefined);w.close();
});
test('messages addressed to a paused agent remain queued and source IDs are preserved',()=>{
 const w=fixture();w.control({paused:false,rolePaused:{deepseek:true}});const i=w.createChat({text:'@DeepSeek 虚构算式',targets:['deepseek']});assert.equal(w.claim('deepseek'),null);const room=roomSnapshot(w);assert.equal(room.messages[0].status[0].paused,true);assert.equal(w.list('delivery')[0].sessionId,PINNED.deepseek.id);w.close();
});
test('old protocol JSON is presented as readable material and opinions',()=>{
 const raw='TRB_REQUEST '+'a'.repeat(64)+' '+JSON.stringify({operation:'请独立审查',case:{title:'虚构水果',material:'苹果六个。'},reviews:{hermes:{verdict:'approve',reason:'算式正确'}}});const text=readable(raw);assert.ok(text.includes('苹果六个'));assert.ok(text.includes('Hermes：通过'));assert.ok(!text.includes('TRB_REQUEST'));assert.ok(!text.includes('"case"'));
 const reply=JSON.stringify({type:'review',case_id:'one',verdict:'approve',conditions:[],reason:'算式正确'});assert.equal(readable(reply),'通过\n\n算式正确');
});
test('passive mirror updates a visible partial answer in place without invoking any sender',async()=>{
 const w=fixture();let content='虚构';const bridge={passive:async role=>({messages:[{id:'original-source',speaker:'assistant',text:content,userText:'虚构问题',streaming:true}],coverage:'SIMULATION_ONLY'})};const mirror=new RoomMirror(w,bridge);
 await mirror.tick();assert.equal(w.list('room_source').length,3);content='虚构算式正确';await mirror.tick();assert.equal(w.list('room_source').length,3);assert.equal(roomSnapshot(w).messages[0].text,content);assert.equal(w.list('delivery').length,0);w.close();
});
test('chat cannot smuggle real-project material through a quoted reply during sandbox testing',()=>{
 const w=fixture();assert.throws(()=>w.createChat({text:'讨论Nagi',targets:['hermes']}));assert.throws(()=>w.createChat({text:'@Hermes 回答引用',targets:['hermes'],replyTo:'one',quote:'凪的真实材料'}));assert.equal(w.list('case').length,0);w.close();
});