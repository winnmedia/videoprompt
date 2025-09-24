/**
 * Processes Layer Public API
 * 비즈니스 프로세스 및 워크플로우 export
 */

// 프로세스 클래스들
export { VideoCreationProcess } from './VideoCreationProcess';
export { ProjectManagementProcess } from './ProjectManagementProcess';
export { ContentCreationWorkflow } from './ContentCreationWorkflow';
export { UserJourneyOrchestrator } from './UserJourneyOrchestrator';

// 타입 exports
export type {
  VideoCreationStep,
  VideoCreationState,
} from './VideoCreationProcess';

export type { Project, ProjectStats } from './ProjectManagementProcess';

export type {
  WorkflowStep,
  ContentCreationState,
  StepTransition,
} from './ContentCreationWorkflow';

export type {
  JourneyContext,
  JourneyEvent,
  NavigationRule,
} from './UserJourneyOrchestrator';
