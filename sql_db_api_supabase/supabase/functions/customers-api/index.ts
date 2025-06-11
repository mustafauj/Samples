// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Hello from Functions!")

// Define the structure of a Customer object
interface Customer {
    id: number;
    fname: string;
    lname: string;
    mobile?: string | null;
    email?: string | null;
    created_at: Date;
}

// Interface for data coming from the API request body for Create/Update operations
interface CustomerInput {
    fname: string;
    lname: string;
    mobile?: string | null;
    email?: string | null;
}

serve(async (req) => {
  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - env var exported by default.
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      // Create client with Auth context of the user that called the function.
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the request method and path
    const url = new URL(req.url)
    const method = req.method
    const path = url.pathname.split('/').pop() // Get the last part of the path

    // Handle different HTTP methods
    switch (method) {
      case 'GET':
        if (path === 'customers') {
          // Get all customers
          const { data, error } = await supabaseClient
            .from('customers')
            .select('*')
          
          if (error) throw error
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          })
        } else if (path) {
          // Get single customer by ID
          const customerId = parseInt(path)
          if (isNaN(customerId)) {
            return new Response(JSON.stringify({ message: 'Invalid customer ID format' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 400,
            })
          }

          const { data, error } = await supabaseClient
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single()

          if (error) {
            if (error.code === 'PGRST116') {
              return new Response(JSON.stringify({ message: 'Customer not found' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404,
              })
            }
            throw error
          }

          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          })
        }
        break

      case 'POST':
        if (path === 'customers') {
          const body: CustomerInput = await req.json()
          const { fname, lname, mobile, email } = body

          if (!fname || !lname) {
            return new Response(JSON.stringify({ message: 'First name (fname) and last name (lname) are required' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 400,
            })
          }

          const { data, error } = await supabaseClient
            .from('customers')
            .insert([{ fname, lname, mobile, email }])
            .select()
            .single()

          if (error) throw error

          return new Response(JSON.stringify({
            message: 'Customer created successfully',
            customerId: data.id
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 201,
          })
        }
        break

      case 'PUT':
        if (path) {
          const customerId = parseInt(path)
          if (isNaN(customerId)) {
            return new Response(JSON.stringify({ message: 'Invalid customer ID format' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 400,
            })
          }

          const body: CustomerInput = await req.json()
          const { fname, lname, mobile, email } = body

          if (!fname || !lname) {
            return new Response(JSON.stringify({ message: 'First name (fname) and last name (lname) are required' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 400,
            })
          }

          const { data, error } = await supabaseClient
            .from('customers')
            .update({ fname, lname, mobile, email })
            .eq('id', customerId)
            .select()
            .single()

          if (error) {
            if (error.code === 'PGRST116') {
              return new Response(JSON.stringify({ message: 'Customer not found' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404,
              })
            }
            throw error
          }

          return new Response(JSON.stringify({ message: 'Customer updated successfully' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          })
        }
        break

      case 'DELETE':
        if (path) {
          const customerId = parseInt(path)
          if (isNaN(customerId)) {
            return new Response(JSON.stringify({ message: 'Invalid customer ID format' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 400,
            })
          }

          const { error } = await supabaseClient
            .from('customers')
            .delete()
            .eq('id', customerId)

          if (error) {
            if (error.code === 'PGRST116') {
              return new Response(JSON.stringify({ message: 'Customer not found' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404,
              })
            }
            throw error
          }

          return new Response(JSON.stringify({ message: 'Customer deleted successfully' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          })
        }
        break
    }

    // If no route matches
    return new Response(JSON.stringify({ message: 'Not Found' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 404,
    })

  } catch (error) {
    // Handle any errors
    return new Response(JSON.stringify({ message: 'Internal Server Error', error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/customers-api' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
