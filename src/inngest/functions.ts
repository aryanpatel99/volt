import { gemini, createAgent, createTool, createNetwork, Agent } from "@inngest/agent-kit";
import { Sandbox } from '@e2b/code-interpreter'

import { inngest } from "./client";
import { getSandbox, lastAssistantTextMessageContext } from "./utils";
import { te } from "date-fns/locale";
import z from "zod";
import { PROMPT } from "@/prompt";

export const helloWorld = inngest.createFunction(
  { id: "hello-world " },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId = await step.run('get-sandbox-id',async()=>{
      const sandbox = await Sandbox.create("volt-nextjs-test-2")
      return sandbox.sandboxId
    })
    const codeAgent = createAgent({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: gemini({ 
        model: "gemini-2.5-flash",
      }),
      tools:[
        createTool({
          name:"terminal",
          description:"Use terminal to run commands",
          parameters: z.object({
            command: z.string()
          }),
          handler: async ( { command } ,{ step } )=>{
            return await step?.run("terminal", async()=>{
              const buffers  = {stdout: "", stderr: ""}
              try {
                const sandbox = await getSandbox(sandboxId)
                const result = await sandbox.commands.run(command,{
                  onStdout: (data:string) => {
                    buffers.stdout += data
                  },
                  onStderr: (data:string) => {
                    buffers.stderr += data
                  }
                })

                return result.stdout
              } catch (error) {
                console.error(
                  `Command Failed: ${error} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`
                )
                return `Command Failed: ${error} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`
              }
            })
          }
        }),

        createTool({
          name:"createOrUpdateFiles",
          description:"Create or update files in the sandbox",
          parameters: z.object({
            files:z.array(
              z.object({
                path:z.string(),
                content:z.string()
              }),
            ),
          }),
          handler: async ({files},{step,network})=>{
            const newFiles = await step?.run("createOrUpdateFiles", async()=>{
              try {
                const updatedFiles = network.state.data.files || {}
                const sandbox = await getSandbox(sandboxId)
                for(const file of files){
                  await sandbox.files.write(file.path, file.content)
                  updatedFiles[file.path] = file.content
                }
                return updatedFiles
              } catch (error) {
                return `Error: ${error}`
              }
            })
            if(typeof newFiles === "object") {
              network.state.data.files = newFiles
            }
          }
        }),

        createTool({
          name:"readFiles",
          description:"Read files from the sandbox",
          parameters: z.object({
            files:z.array(z.string()),
          } ),
          handler: async ({files},{step}) =>{
            return await step?.run("readFiles", async()=>{
              try {
                const sandbox = await getSandbox(sandboxId)
                const contents  = []
                for (const file of files){
                  const content = await sandbox.files.read(file)
                  contents.push({path:file,content})
                }
                return JSON.stringify(contents)
              } catch (error) {
                return `Error: ${error}`
              }
            })
          }
        })
      ],

      lifecycle:{
        onResponse : async ({result, network})=>{
          const lastAssistantMessageText = lastAssistantTextMessageContext(result)

          if(lastAssistantMessageText && network){
            if(lastAssistantMessageText.includes("<task_summary>")){
              network.state.data.summary = lastAssistantMessageText
            }
          }

          return result
        }
      }
    });


    const network = createNetwork({
      name:"coding-agent-network",
      agents:[codeAgent],
      maxIter : 4 ,  //limit the number of iterations for the network to stop 
      router: async({network})=>{
        const summary = network.state.data.summary

        if(summary){
          return
        }

        return codeAgent
      }

    })

    const result = await network.run(event.data.value)

    const sandboxUrl = await step.run("get-sandbox-url",async()=>{
      const sandbox = await getSandbox(sandboxId)
      const host = sandbox.getHost(3000)      //create the host under the port 3000
      return `https://${host}`
    })


// [{ role: 'assistant', content: 'function removeUnecessaryWhitespace(...' }]

    return {  
      url: sandboxUrl,
      title:"Fragment",
      files:result.state.data.files,
      summary:result.state.data.summary
    };
  },
);
