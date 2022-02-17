import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { Box, ChakraProvider, Flex, Spinner, Text } from "@chakra-ui/react";

import SubredditConfigMenu from "./components/SubredditConfigMenu";
import NoSubredditsFoundMessage from "./components/NoSubredditsFoundMessage";
import useSubredditData from "./composables/useSubredditData";

const Popup = () => {
  const {
    subredditData,
    isLoadingSubreddits,
    updateSubredditFeedFrequency,
  } = useSubredditData();

  const loadingSubreddits: JSX.Element = (
    <Flex align="center" flexDir={'column'} pt={'10px'}>
      <Spinner />
      <Text pt={'5'} fontSize={'sm'}>Loading subreddits...</Text>
    </Flex>
  );

  const subredditConfigMenu: JSX.Element = (
    <SubredditConfigMenu
      subredditData={subredditData}
      onSubredditFrequencyChange={updateSubredditFeedFrequency}
    />
  );

  return (
    <Box w={'250px'} minH={'200px'} p={'4'} >
      {isLoadingSubreddits
        ? loadingSubreddits
        : subredditData.length
          ? subredditConfigMenu
          : <NoSubredditsFoundMessage />
      }
    </Box>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <ChakraProvider>
      <Popup />
    </ChakraProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
