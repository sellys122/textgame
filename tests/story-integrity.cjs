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
for(const i of [1,2,3]){run(`setup();R.node='c2fork';applyChoice(STORY_NODES.c2fork.choices[${i}]);`);run("if(R.pending?.kind==='text')showPending()");assert(run("M.equipment.includes('mineStaff')"));assert(run("R.quests.includes('waterMap')"));assert.equal(run('R.node'),'c2map');}
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
// Inline results must settle exactly once without a modal or confirmation click.
run("modal=()=>{throw Error('Unexpected outcome modal')};setup();R.node='c3tea';");
const startingGold=run('M.gold');
run("applyChoice({text:'받는다',result:'사례금을 받았다.',gold:7,next:'c1done'})");
assert.equal(run('R.pending'),null);assert.equal(run('M.gold'),startingGold+7);assert(run("currentNode().text.includes('사례금을 받았다.')"));run('showPending()');assert.equal(run('M.gold'),startingGold+7);
run("setup();R.node='p2';Math.random=()=>.99;choose(0)");assert.equal(run('R.pending'),null);assert.equal(run('R.node'),'p2track');assert(run('R.storyFlow.length>0'));
run("setup();R.node='__event';R.event={id:'merchant',stage:0,next:'c1rival'};R.usedEvents=['merchant'];Math.random=()=>.99;choose(0)");assert.equal(run('R.event.stage'),1);assert.equal(run('R.pending'),null);assert(run('R.storyFlow.length>0'));
run('choose(0)');assert.equal(run('R.node'),'c1rival');assert.equal(run('R.inventory.potion'),1);assert.equal(run('R.pending'),null);
// Pending results restored from an older save use the same inline path.
run("setup();R.pending={kind:'text',text:'古い'.replace('古い','물건을 건넸다.'),choice:{next:'c1done',gold:3}};showPending()");assert.equal(run('R.pending'),null);assert.equal(run('R.node'),'c1done');
// Sera keeps her meaningful reroll decision, in-page and before applying the loss.
run("setup();R.character='sera';M.characters.sera={rank:5,equipped:{}};R.node='p2';Math.random=()=>0;choose(0)");assert.equal(run('R.pending.kind'),'check');assert.equal(run('R.hp'),5);
run('Math.random=()=>.99;settleStoryCheck(true)');assert.equal(run('R.node'),'p2track');assert(run('R.traitUses.reroll'));assert.equal(run('R.pending'),null);
run("setup();R.side={active:'lantern',returnNode:'p6',returnChapter:0,outcomes:{}};completeSideStory('lantern_kept');showPending()");assert.equal(run('R.node'),'p6');assert.equal(run('R.pending'),null);assert(run("currentNode().text.includes('등불')"));
// Pure transit pages advance automatically, retaining the relevant narrative.
run("setup();go('c1dungeonChild')");assert.equal(run('R.node'),'c1chapel');assert(run("currentNode().text.includes('아이가 문지기')"));
run("setup();R.node='c1fight';startBattle('wolf','c1done');winBattle();showVictory()");assert.equal(run('R.node'),'c1done');assert.equal(run('R.battle'),null);assert.equal(run('M.records.battles'),1);
console.log('PASS: inline choice/check/event/side/battle results; saved result migration; no double rewards; Sera reroll; transit chaining.');
run("setup();R.node='__event';R.event={id:'trap',stage:0,next:'c1fight'};Math.random=()=>0;choose(0)");assert.equal(run('R.hp'),4);assert.equal(run('R.event.stage'),1);run('showPending()');assert.equal(run('R.hp'),4);
run("setup();R.hp=3;go('c1armyAfter')");assert.equal(run('R.node'),'c1armyReport');assert.equal(run('R.hp'),5);assert.equal(run('R.inventory.potion'),1);
console.log('PASS: event failure damage settles once; automatic transit keeps healing and rewards.');
