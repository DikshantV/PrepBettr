'use client';
import { Timeline, Text, rem } from '@mantine/core';
import { IconUpload, IconBulb, IconMessageDots, IconRepeat, IconQuestionMark, IconRocket, IconTarget, IconTrophy, IconAnalyze } from '@tabler/icons-react';
import { useTheme } from 'next-themes';

export default function TimelineCompact() {
  const { theme, resolvedTheme } = useTheme();
  
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <Timeline
        active={7}
        bulletSize={32}
        lineWidth={3}
        radius="lg"
        color="dark"
        classNames={{
          root: 'w-full max-w-md',
          item: 'mb-2 last:mb-0',
          itemTitle: 'text-sm md:text-base font-bold text-neutral-900 dark:text-white mb-1 tracking-tight',
          itemBullet: '!bg-black !border !border-white [&>*]:!bg-black',
          itemBody: 'text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-normal',
        }}
        styles={{
          itemBullet: {
            backgroundColor: '#000000 !important',
            border: '1px solid white !important',
            borderRadius: '50% !important',
          },
        }}
      >
        <Timeline.Item 
          title="Upload Your Resume" 
          bullet={<IconUpload size={16} color="white" />}
        >
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Upload your resume and let our AI analyze your experience
          </Text>
        </Timeline.Item>
        <Timeline.Item 
          title="AI Question Generation" 
          bullet={<IconQuestionMark size={16} color="white" />}
        >
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Get personalized questions based on your target role
          </Text>
        </Timeline.Item>
        <Timeline.Item 
          title="Practice Interview" 
          bullet={<IconBulb size={16} color="white" />}
        >
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Practice with voice or text-based mock interviews
          </Text>
        </Timeline.Item>
        <Timeline.Item 
          title="Real-time Feedback" 
          bullet={<IconMessageDots size={16} color="white" />}
        >
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Receive instant AI-powered feedback and suggestions
          </Text>
        </Timeline.Item>
        <Timeline.Item 
          title="Performance Analytics" 
          bullet={<IconAnalyze size={16} color="white" />}
        >
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Track your progress with detailed analytics
          </Text>
        </Timeline.Item>
        <Timeline.Item 
          title="Skill Improvement" 
          bullet={<IconTarget size={16} color="white" />}
        >
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Focus on weak areas with targeted practice
          </Text>
        </Timeline.Item>
        <Timeline.Item 
          title="Land Your Dream Job" 
          bullet={<IconTrophy size={16} color="white" />}
        >
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Apply with confidence and ace your interviews
          </Text>
        </Timeline.Item>
      </Timeline>
    </div>
  );
}
