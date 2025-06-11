import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    // Get the last part of the path
    const pathParts = url.pathname.split('/')
    const endpoint = pathParts[pathParts.length - 1]

    console.log('Request received:', {
      method: req.method,
      path: endpoint,
      url: req.url
    })

    // GET endpoint
    if (req.method === 'GET' && endpoint === 'getp') {
      return new Response(
        JSON.stringify({ message: 'GET is working successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // POST endpoint
    if (req.method === 'POST' && endpoint === 'postp') {
      const body = await req.json()
      return new Response(
        JSON.stringify({
          message: 'POST is working successfully',
          received_data: body,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        }
      )
    }

    // PUT endpoint
    if (req.method === 'PUT' && endpoint === 'putp') {
      const body = await req.json()
      return new Response(
        JSON.stringify({
          message: 'PUT is working successfully',
          received_data: body,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // DELETE endpoint
    if (req.method === 'DELETE' && endpoint === 'deletep') {
      return new Response(
        JSON.stringify({ message: 'DELETE is working successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Debug endpoint to check if function is working
    if (endpoint === 'api') {
      return new Response(
        JSON.stringify({ 
          message: 'API is working',
          endpoints: ['/getp', '/postp', '/putp', '/deletep']
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Handle 404
    return new Response(
      JSON.stringify({ 
        error: 'Not Found',
        path: endpoint,
        method: req.method,
        available_endpoints: ['/getp', '/postp', '/putp', '/deletep']
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 