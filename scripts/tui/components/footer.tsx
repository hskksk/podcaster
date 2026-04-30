import React from 'react';
import { Box, Text } from 'ink';

export const Footer: React.FC = () => {
  return (
    <Box paddingX={1} borderStyle="classic" borderColor="gray">
      <Text color="gray">
        <Text color="white" bold>1-8</Text>: Switch View │ 
        <Text color="white" bold> /</Text>: Global filter │ 
        <Text color="white" bold> :</Text>: Cmd │ 
        <Text color="white" bold> ?</Text>: Help │ 
        <Text color="white" bold> q</Text>: Quit
      </Text>
    </Box>
  );
};
