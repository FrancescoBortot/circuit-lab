/* Playback moves a reading cursor; it never resamples or recalculates a result. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ReadingPlayback=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class ReadingPlayback{
    constructor({write,onState=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),delay=1000}){
      this.write=write;this.onState=onState;this.schedule=schedule;this.cancel=cancel;this.delay=delay;this.running=false;this.generation=0;
    }
    pause(){this.generation++;if(this.timer!==undefined)this.cancel(this.timer);this.timer=undefined;this.running=false;this.onState(false);}
    setDelay(ms){if(!Number.isFinite(ms)||ms<250||ms>2000)throw Error('Intervallo di lettura non valido');this.delay=ms;if(this.running){this.cancel(this.timer);this.queue();}}
    start(value,range){
      this.pause();if(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[1]<=range[0]||!Number.isFinite(value))return false;
      this.range=[...range];this.value=clamp(value,...range);if(this.value>=range[1]){this.value=range[0];this.write(this.value);}
      this.running=true;this.onState(true);this.queue();return true;
    }
    queue(){const generation=++this.generation;this.timer=this.schedule(()=>{
      if(!this.running||generation!==this.generation)return;
      this.value=ReadingPlayback.step(this.value,this.range,1);this.write(this.value);
      if(this.value>=this.range[1])this.pause();else this.queue();
    },this.delay);}
    static step(value,range,direction){const[a,b]=range;return clamp(value+Math.sign(direction)*(b-a)/100,a,b);}
  }
  return ReadingPlayback;
});
