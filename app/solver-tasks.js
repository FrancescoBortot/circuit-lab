/* A fresh local worker per calculation: termination cancels numerical work. */
(() => {
  'use strict';
  class CircuitTasks{
    cancel(){
      const job=this.job;if(!job)return;this.job=null;job.worker.terminate();URL.revokeObjectURL(job.url);
      const error=new Error('Calcolo annullato.');error.name='AbortError';job.reject(error);
    }
    run(action,payload={},onProgress=()=>{}){
      this.cancel();
      return new Promise((resolve,reject)=>{
        if(typeof Worker==='undefined'||!window.CircuitSolverSource){reject(new Error('Questo browser non rende disponibile il calcolo locale separato.'));return;}
        let worker,url;
        const finish=(error,result)=>{if(this.job?.worker!==worker)return;this.job=null;worker.terminate();URL.revokeObjectURL(url);if(error)reject(error);else resolve(result);};
        try{
          url=URL.createObjectURL(new Blob([window.CircuitSolverSource],{type:'text/javascript'}));worker=new Worker(url);
          this.job={worker,url,reject};
          worker.onmessage=({data})=>{if(this.job?.worker!==worker)return;if(data.type==='progress')onProgress(data.fraction);else if(data.type==='result')finish(null,data.result);else if(data.type==='error')finish(new Error(data.message));};
          worker.onerror=()=>finish(new Error('Il calcolo locale separato non è disponibile o si è interrotto.'));
          worker.postMessage({action,...payload});
        }catch(error){if(worker)worker.terminate();if(url)URL.revokeObjectURL(url);this.job=null;reject(error);}
      });
    }
  }
  window.CircuitTasks=CircuitTasks;
})();
