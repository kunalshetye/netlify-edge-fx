import type { Config, Context } from "https://edge.netlify.com/";

import {
  enums as OptimizelyEnums,
  createInstance
} from "https://esm.sh/@optimizely/optimizely-sdk";


export default async function handler(req: Request, {cookies}: Context) {

  const sdkKey = Netlify.env.get("OPTIMIZELY_SDK_KEY");
  const flagKey = Netlify.env.get("FLAG_KEY") || "discount";
  
  console.log(`sdkKey: ${sdkKey} - flagKey: ${flagKey}`);

  // fetch datafile from optimizely CDN and cache it with cloudflare for the given number of seconds
  const datafile = await getDatafile(sdkKey, 600);

  const userId = crypto.randomUUID();

  const optimizelyClient = createInstance({
    datafile,

    // keep the LOG_LEVEL to ERROR in production. Setting LOG_LEVEL to INFO or DEBUG can adversely impact performance.
    logLevel: OptimizelyEnums.LOG_LEVEL.ERROR,

    /***
     * Optional event dispatcher. Please uncomment the following line if you want to dispatch an impression event to optimizely logx backend.
     * When enabled, an event is dispatched asynchronously. It does not impact the response time for a particular worker but it will
     * add to the total compute time of the worker and can impact cloudflare billing.
     */

    /* eventDispatcher: {
      dispatchEvent: optimizelyEvent => {
        // Tell cloudflare to wait for this promise to fullfill.
        event.waitUntil(dispatchEvent(optimizelyEvent));
      }
    }, */

    /* Add other Optimizely SDK initialization options here if needed */
  });

  const optimizelyUserContext = optimizelyClient.createUserContext(
    userId,
    {
      /* YOUR_OPTIONAL_ATTRIBUTES_HERE */
    }
  );

  // --- Using Optimizely Config
  const optimizelyConfig = optimizelyClient.getOptimizelyConfig();

  // --- For a single flag --- //
  const decision = optimizelyUserContext.decide(flagKey);
  let message = "";

  if (decision.enabled) {
    message = `The Flag "${
      decision.flagKey
    }" was Enabled for the user "${decision.userContext.getUserId()}"`;
  } else {
    message = `The Flag "${
      decision.flagKey
    }" was Not Enabled for the user "${decision.userContext.getUserId()}"`;
  }

  console.log(message);
  return new Response(message);
}

export const config: Config = {
  path: "/",
};

/**
 *    Copyright 2021-2022, Optimizely and contributors
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

const BACKEND_CDN = "optlycdn";
const BACKEND_LOGX = "optlylogx";

export async function getDatafile(sdkKey, ttl) {
  const dataFileRequest = new Request(
    `https://cdn.optimizely.com/datafiles/${sdkKey}.json`
  );
  
  const fetchedDatafile = await fetch(dataFileRequest, {
    backend: BACKEND_CDN,
  });
  return await fetchedDatafile.text();
}

export function dispatchEvent({ url, params }) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const eventRequest = new Request(url, {
    method: "POST",
    body: JSON.stringify(params),
    headers,
  });
  fetch(eventRequest, { backend: BACKEND_LOGX });
}
