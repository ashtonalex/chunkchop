import { ProcessInfo } from './ProcessUtils.js';

export const TARGET_BATCH_SIZE = 32;

/**
 * Distributes a list of processes evenly into an array of smaller arrays (batches).
 * @param processes - The array of uncached processes to be analyzed.
 * @returns An array of batches, where each batch is an array of ProcessItem.
 */
export function createProcessBatches(processes: ProcessInfo[]): ProcessInfo[][] {
  if (processes.length === 0) {
    return [];
  }

  // Calculate the number of batches needed to maintain the target batch size
  const numBatches = Math.ceil(processes.length / TARGET_BATCH_SIZE);

  const batches: ProcessInfo[][] = [];
  
  for (let i = 0; i < numBatches; i++) {
    batches.push([]);
  }

  // Distribute processes round-robin style to ensure evenness
  processes.forEach((process, index) => {
    const batchIndex = index % numBatches;
    batches[batchIndex].push(process);
  });

  return batches;
}
