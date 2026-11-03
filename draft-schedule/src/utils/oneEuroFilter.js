const alpha=(cutoff,dt)=>1/(1+1/(2*Math.PI*cutoff*dt))
export function createOneEuro(value,time){return {raw:value,value,derivative:0,time}}
export function filterOneEuro(state,raw,time,{minCutoff,beta}){
  const dt=Math.max(.001,Math.min(.2,(time-state.time)/1000))
  state.derivative+=((raw-state.raw)/dt-state.derivative)*alpha(1,dt)
  state.value+=(raw-state.value)*alpha(minCutoff+beta*Math.abs(state.derivative),dt)
  state.raw=raw;state.time=time
  return state.value
}
