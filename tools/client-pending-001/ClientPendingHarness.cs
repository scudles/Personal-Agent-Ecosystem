using System;using System.IO;using System.Collections.Generic;using System.Threading.Tasks;
namespace TriReviewBridge {
 public static class ClientPendingHarness {
  public static int Main(string[] args){Console.OutputEncoding=new System.Text.UTF8Encoding(false);try{Run(args).GetAwaiter().GetResult();return 0;}catch(Exception ex){Console.WriteLine(Json.Show(Json.D("fatal",ex.ToString())));return 1;}}
  static async Task Run(string[] args){
   string config=args[0],mode=args[1],path=args[2];object body=Json.Codec.DeserializeObject(File.ReadAllText(args[3]));string project=Json.Str(body,"projectId"),workspace=path.Split('/')[3];var client=new BridgeClient(config);bool success=false,cleared=false;string error="",requestKey=null;object result=null;
   using(var draft=new DraftFileStore(Path.GetDirectoryName(config),config,"fake")){
    var drafts=draft.Load();if(mode=="attempt"||mode=="commit-ui"){drafts[workspace]=new LocalDraft(){Text=Json.Str(body,"text"),ReplyId=Json.Str(body,"replyTo")};draft.Save(drafts);try{result=await client.Call(path,body);success=true;}catch(Exception ex){error=ex.Message;}}
    else if(mode=="recover-ack"||mode=="consume"){try{result=await client.ReplayPending(project,workspace);success=true;}catch(Exception ex){error=ex.Message;}}
    else if(mode=="preview"){var preview=client.PendingSend(project,workspace);if(preview==null)throw new Exception("Missing preview");File.WriteAllText(args[4],Json.Show(preview));success=true;}
    else if(mode=="replay-preview"){try{var expected=Json.Codec.Deserialize<PendingClientSend>(File.ReadAllText(args[4]));result=await client.ReplayPending(expected);success=true;}catch(Exception ex){error=ex.Message;}}
    else if(mode=="prepare-ticket"){var store=new ClientPendingStore(config);var ticket=store.Prepare(path,Json.Show(body));File.WriteAllText(args[4],Json.Show(ticket));success=true;}
    else if(mode=="send-ticket"){try{var ticket=Json.Codec.Deserialize<PendingSendTicket>(File.ReadAllText(args[4]));var method=typeof(BridgeClient).GetMethod("SendTracked",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic);result=await (Task<object>)method.Invoke(client,new object[]{ticket});success=true;}catch(Exception ex){error=ex.InnerException==null?ex.Message:ex.InnerException.Message;}}
    else if(mode!="inspect")throw new Exception("Unknown fake harness action");
    var pending=client.PendingSend(project,workspace);if(pending!=null)requestKey=pending.RequestKey;
    if(success&&(mode=="consume"||mode=="commit-ui")){if(pending==null)throw new Exception("Expected acknowledged pending metadata");cleared=ClientPendingStore.ClearRecoveredDraft(pending,path,Json.Show(body),result);if(cleared)drafts[workspace]=new LocalDraft();draft.Save(drafts);client.FinishLogicalSend(project,workspace);}
    var after=client.PendingSend(project,workspace);var saved=draft.Load();Console.WriteLine(Json.Show(Json.D("success",success,"error",error,"requestKey",requestKey,"pendingKey",after==null?null:after.RequestKey,"pendingState",after==null?null:after.State,"payload",after==null?null:after.Payload,"cleared",cleared,"draftText",saved.ContainsKey(workspace)?saved[workspace].Text:null,"savedWorkspaceCount",saved.Count,"resultStatus",result==null?null:Json.Str(result,"status"),"nativeState",result==null?null:Json.Str(Json.Get(result,"result"),"nativeState"),"realAgentOperations",0)));
   }
  }
 }
}
