const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
source=source.replace('loadVisualAssets();render();if(storageWarning)toast(storageWarning);','');
const noop=()=>{};
const dom={classList:{add:noop,remove:noop,toggle:noop},style:{setProperty:noop},insertAdjacentHTML:noop};
const context=vm.createContext({console,localStorage:{getItem:()=>null,setItem:noop},document:{addEventListener:noop,querySelector:()=>dom,querySelectorAll:()=>[],documentElement:dom},window:{addEventListener:noop},setTimeout:noop,clearTimeout:noop,setInterval:noop,clearInterval:noop});
vm.runInContext(source,context);
vm.runInContext(`
render=()=>{};closeModal=()=>{};toast=()=>{};save=()=>{};AudioGame.sfx=()=>{};checkAchievements=()=>{};
function resetMine(){M=defaultMeta();M.settings.difficulty='normal';M.adventureLedger={};R={uid:'test',character:'rowen',hp:5,node:'c2fork',chapter:2,route:null,flags:{},npcs:{},quests:[],inventory:{},equipped:{weapon:'oldSword'},status:{poison:0},traitUses:{},log:[],usedEvents:[],growth:{level:1,xp:0,points:0,allocation:[0,0,0,0,0,0],visited:[],totalXP:0}};}
globalThis.testChoice=STORY_NODES.c2fork.choices[0];
`,context);
function test(code){return vm.runInContext(code,context);}
test('resetMine(); R.pending={choice:testChoice,roll:{success:true}};resolveCheck();');
assert(test("M.equipment.includes('mineStaff')"),'successful search grants staff');
assert(test("R.quests.includes('waterMap')"),'successful search retains map');
assert.equal(test('R.node'),'c2map');
assert.equal(test('R.equipped.weapon'),'oldSword');
test('resetMine(); R.pending={choice:testChoice,roll:{success:false}};resolveCheck();');
assert(!test("M.equipment.includes('mineStaff')"),'failed search must not grant staff');
assert(!test("R.quests.includes('waterMap')"),'failed search must not grant map');
assert.equal(test('R.hp'),4);
assert.equal(test('R.node'),'c2map');
test('resetMine();R.pending={choice:testChoice,roll:{success:true}};resolveCheck();R.node="c2fork";R.pending={choice:testChoice,roll:{success:true}};resolveCheck();');
assert.equal(test("M.equipment.filter(id=>id==='mineStaff').length"),1);
// A normal check with no successEffects keeps its original successful outcome.
test('resetMine(); R.pending={choice:{stat:3,dc:10,next:"c2map",success:"약속했다.",flags:{careNetwork:true}},roll:{success:true}};resolveCheck();');
assert(test('R.flags.careNetwork'));
console.log('PASS: successful search grants staff and map, preserves weapon; failure grants neither and costs one life; repeat has no duplicate; ordinary success unchanged.');


