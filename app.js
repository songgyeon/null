/* NULL web entry.
   QA 진입점을 고르고, data → UI → game 선언이 준비된 뒤 앱을 마운트한다. */
/* 프로필 좌표 검수는 실제 판과 상태를 하나도 공유하지 않는다.
   전에는 App 안에서 등록 화면만 덮었다. 그 뒤의 RoomList도 함께 살아 있어서
   오늘을 봤다고 저장하고, 야자 주에는 가방에 에너지바까지 넣었다. */
function ProfileQA(){
  const [name,setName]=useState("리리");
  const [profile,setProfile]=useState({});
  const [mode,setMode]=useState("real");
  const [screen,setScreen]=useState("enroll");
  return <div className="phone">
    {screen==="enroll"&&<Enroll name={name} profile={profile}
      onDone={()=>setScreen("confirm")} onClose={()=>{}}
      mode={mode} onMode={setMode} onRename={setName}
      onSaveField={(k,v)=>setProfile(p=>({...p,[k]:v}))}/>}
    {screen==="confirm"&&<Confirm name={name}
      onYes={()=>setScreen("enroll")} onBack={()=>setScreen("enroll")}/>}
  </div>;
}

function App(){
  const qaProfile=(()=>{try{return new URLSearchParams(location.search).get("qa")==="profile"}catch(e){return false}})();
  return qaProfile?<ProfileQA/>:<GameApp/>;
}

/* 모든 선언이 준비된 뒤 앱을 한 번만 마운트한다. */
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
