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
  
  // Calculate the optimal size for each batch to be as even as possible
  const batchSize = Math.ceil(processes.length / numBatches);

  const batches: ProcessInfo[][] = [];
  
  // We can't just use slice with a fixed batchSize because we want to distribute evenly.
  // Actually, if we use the calculated numBatches, we can just distribute items in a round-robin or chunk them.
  // The requirement says "distribute the processes as evenly as possible".
  
  // Approach:
  // We have N items and K batches. 
  // Base size = floor(N/K). 
  // Remainder R = N % K.
  // First R batches get Base + 1, rest get Base.
  
  // However, simpler implementation that is "even enough":
  // valid manual loop or reduce.
  
  // Let's use a simple chunking with dynamic calculation or just filling buckets.
  
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
