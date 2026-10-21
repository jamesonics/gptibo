type Task = { name: string; run: () => Promise<unknown> }

// A failed supplier must not prevent the other queues from being reconciled.
// Only fixed task names and counts are logged; no payloads or exception messages.
export async function runScheduledTasks(tasks: Task[]) {
  const results = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task.run)))
  let failed = false
  for (const [index, result] of results.entries()) {
    const count = result.status === 'fulfilled' && result.value && typeof result.value === 'object' && 'failed' in result.value ? Number(result.value.failed) : 0
    if (result.status === 'rejected' || count > 0) {
      failed = true
      console.error('reconciliation-failed', tasks[index].name)
    }
  }
  return failed
}
