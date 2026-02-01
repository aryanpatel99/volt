import React, { Suspense } from 'react'
// "use client"
import { useTRPC } from '@/trpc/client'
import { caller, getQueryClient,trpc } from '@/trpc/server'
import { dehydrate, HydrationBoundary, useQuery } from '@tanstack/react-query'
import { Client } from './client'

const page = async() => {
  const queryClient = getQueryClient()
  void queryClient.prefetchQuery(trpc.createAi.queryOptions({text: "a prefetch"}))


  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<div>Loading...</div>}>

      <Client/>
      </Suspense>
    </HydrationBoundary>
  )
}

export default page