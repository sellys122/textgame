const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');let src=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('loadVisualAssets();render();if(storageWarning)toast(storageWarning);','');
const noop=()=>{},dom={classList:{add:noop,remove:noop,toggle:noop},style:{setProperty:noop},insertAdjacentHTML:noop};
const ctx=vm.createContext({console,localStorage:{getItem:()=>null,setItem:noop},document:{addEventListener:noop,querySelector:()=>dom,querySelectorAll:()=>[],documentElement:dom},window:{addEventListener:noop},setTimeout:noop,clearTimeout:noop,setInterval:noop,clearInterval:noop});vm.runInContext(src,ctx);const run=c=>vm.runInContext(c,ctx);
run(`render=()=>{};save=()=>{};closeModal=()=>{};toast=()=>{};checkAchievements=()=>{};AudioGame.sfx=()=>{};
function setup(){M=defaultMeta();M.settings.difficulty='normal';M.adventureLedger={};R={uid:'audit',character:'rowen',hp:5,combatHP:18,node:'p0',chapter:0,route:null,flags:{},npcs:{},quests:[],inventory:{},equipped:{weapon:'oldSword'},status:{poison:0},traitUses:{},log:[],usedEvents:[],growth:{level:1,xp:0,points:0,allocation:[0,0,0,0,0,0],visited:[],totalXP:0}};}setup();`);
const data=JSON.parse(run('JSON.stringify({nodes:STORY_NODES,events:EVENTS,endings:ENDINGS,sideEndings:SIDE_ENDINGS,characters:CHARACTERS,stories:SIDE_STORIES})'));
let choices=0,checks=0;
for(const [id,n]of Object.entries(data.nodes))for(const list of [n.choices,...(n.variants||[]).map(x=>x.choices||[])])for(const o of list||[]){choices++;for(const key of ['next','successNext','failureNext'])if(o[key]&&!o[key].startsWith('__'))assert(data.nodes[o[key]],id+' missing '+o[key]);if(o.ending)assert(data.endings[o.ending]);if(o.sideEnding)assert(data.sideEndings[o.sideEnding]);if(o.event)assert(data.events[o.event]);if(o.stat!==undefined){checks++;assert(o.success&&o.failure,id+' missing outcomes');assert(Number.isFinite(o.dc));}if(o.finalEnding){assert.equal(o.next,'OUT_'+o.finalEnding);assert.equal(data.nodes[o.next].choices[0].ending,o.finalEnding);}}
for(const[id,e]of Object.entries(data.events)){assert.equal(e.reward.gold,0);assert(e.success&&e.failure&&e.follow);}
function audit(o){for(const v of Object.values(o)){if(typeof v==='string')assert(!/대신|아니라|아닌|셈이었다/.test(v),v);else if(v&&typeof v==='object')audit(v);}}audit(data);
// Enumerate all 20 die faces and compare the displayed probability against actual rollCheck.
run('const originalStatValue=statValue;statValue=()=>globalThis.auditStat;');
let cases=0;
for(const character of ['rowen','cassian','neris','serion','toren'])for(const opt of [{},{trap:true},{ancient:true},{noble:true},{beast:true},{undead:true}])for(const stat of [0,1,3,5,7,10,12])for(const dc of [13,14,15,16]){
run(`setup();R.character=${JSON.stringify(character)};auditStat=${stat};globalThis.auditOpt=${JSON.stringify(opt)};`);const displayed=run(`checkChance(2,${dc},auditOpt).percent`);let wins=0;
for(let raw=1;raw<=20;raw++){run(`R.traitUses={};Math.random=()=>(${raw}-.5)/20`);if(run(`rollCheck(2,${dc},auditOpt).success`))wins++;}
assert.equal(displayed,wins*5,`${character}/${stat}/${dc}`);cases++;
}
run('setup();auditStat=1');assert.equal(run('checkChance(0,13).percent'),45);run('auditStat=7');assert.equal(run('checkChance(0,13).percent'),75);run('statValue=originalStatValue');
// Proof is not granted by a failed medical examination.
run("setup();R.node='D2';R.route='D';R.pending={choice:STORY_NODES.D2.choices[1],roll:{success:false}};resolveCheck()");assert.equal(run('R.flags.proof'),false);assert.equal(run('R.node'),'D3');
// Every prepared way of opening the map gate also retrieves the staff.
for(const i of [1,2,3]){run(`setup();R.node='c2fork';applyChoice(STORY_NODES.c2fork.choices[${i}]);`);run('applyChoice(R.pending.choice)');assert(run("M.equipment.includes('mineStaff')"));assert(run("R.quests.includes('waterMap')"));assert.equal(run('R.node'),'c2map');}
// The puzzle's clue and answer use the same symbols.
assert(/물, 왕관, 태양/.test(data.nodes.E1.text));assert(/물 → 왕관 → 태양/.test(data.nodes.E1.choices[0].text));
// Short-story conclusions resume the main adventure rather than terminate it.
for(const[id,e]of Object.entries(data.sideEndings)){run(`setup();R.side={active:${JSON.stringify(e.story)},returnNode:'c1done',returnChapter:1,outcomes:{}};completeSideStory(${JSON.stringify(id)});`);assert.equal(run('R.ending'),undefined);assert.equal(run('R.pending.kind'),'sideConclusion');run('returnFromSideStory()');assert.equal(run('R.node'),'c1done');}
console.log(JSON.stringify({pass:true,nodes:Object.keys(data.nodes).length,choices,storyChecks:checks,events:Object.keys(data.events).length,mainEndings:Object.keys(data.endings).length,sideEndings:Object.keys(data.sideEndings).length,probabilityCases:cases,dieFaces:cases*20}));
// Check real selectable outcomes for every stat check, including variant choices.
let outcomeCases=0;
for(const[id,n]of Object.entries(data.nodes))for(const list of [n.choices,...(n.variants||[]).map(x=>x.choices||[])])for(const o of list||[])if(o.stat!==undefined){
 for(const success of [true,false]){
 run(`setup();R.node=${JSON.stringify(id)};R.chapter=${n.chapter};globalThis.auditChoice=${JSON.stringify(o)};R.pending={choice:auditChoice,roll:{success:${success}}};resolveCheck();`);
 // Result popups and battle transitions are valid intermediate states; next must remain resolvable.
 assert(run("!!R.pending||!!R.battle||!!R.ending||!!STORY_NODES[R.node]||R.node.startsWith('__')"),id);
 outcomeCases++;
 }
}
// The trapped chest pays only the coins described by each outcome.
for(const success of [true,false]){run(`setup();R.node='c1dungeonChest';globalThis.goldBefore=M.gold;R.pending={choice:STORY_NODES.c1dungeonChest.choices[0],roll:{success:${success}}};resolveCheck();`);assert.equal(run('M.gold-goldBefore'),success?40:10);assert.equal(run("M.equipment.includes('luckyRing')"),success);}
console.log('PASS: '+outcomeCases+' success/failure transitions; trapped chest reward matches both outcomes.');
