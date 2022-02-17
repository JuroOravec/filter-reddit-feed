import React, { useState } from "react";
import PropTypes from 'prop-types';
import { Box, BoxProps, Divider, List, ListIcon, ListItem, Text } from "@chakra-ui/react";
import { BsCircle, BsCircleFill, BsCircleHalf } from "react-icons/bs";
import debounce from "lodash/debounce";

import SubredditSlider from "./SubredditSlider";
import SubredditSearch from "./SubredditSearch";
import type { SubredditData } from "@/composables/useSubredditData";

export interface SubredditConfigMenuProps extends BoxProps {
  subredditData?: Readonly<SubredditData[]>;
  onSubredditFrequencyChange?: (input: { internalId: string, frequency: number }) => void;
}

const SubredditConfigMenu = (props: SubredditConfigMenuProps) => {
  const { subredditData, onSubredditFrequencyChange, ...boxProps } = props;

  const [searchedSubreddit, setSearchedSubreddit] = useState<string>('');

  const searchedSubredditRegex = new RegExp(`${searchedSubreddit.replace(/\s+/g, '')}`, 'i');
  const filteredSubredditData: Readonly<SubredditData[]> = (
    !searchedSubreddit
      ? subredditData
      : subredditData?.filter(({ subreddit }): boolean =>
        // Note: we use String.search instead of RegExp.test because the latter is stateful
        subreddit.subredditName.search(searchedSubredditRegex) !== -1
      )
  ) ?? [];

  // Reduce how often we emit the change 
  const debouncedOnSubredditFrequencyChange = debounce(onSubredditFrequencyChange || (() => { }), 100);

  const sliders: JSX.Element[] = filteredSubredditData.map(({ subreddit, subredditFeed }) => (
    <SubredditSlider
      key={subreddit.internalId}
      subreddit={subreddit}
      subredditFeed={subredditFeed}
      onChange={(newFrequency) => debouncedOnSubredditFrequencyChange({
        internalId: subreddit.internalId,
        frequency: newFrequency,
      })}
      width={'200px'}
      m={'auto'}
    />
  ));

  return (
    <Box {...boxProps}>
      <Box fontSize={'xs'}>
        Set how often you see posts from different subreddits on your homepage or in multireddits:

        <List spacing={1} pt={'5px'}>
          <ListItem>
            <ListIcon as={BsCircleFill} color="blue.500" />
            <Text as="u">No</Text> posts are hidden
          </ListItem>
          <ListItem>
            <ListIcon as={BsCircleHalf} color="blue.500" transform={'rotate(180deg)'} />
            <Text as="u">Half</Text> of posts are hidden
          </ListItem>
          <ListItem>
            <ListIcon as={BsCircle} color="blue.500" />
            <Text as="u">All</Text> of posts are hidden
          </ListItem>
        </List>
      </Box>
      <Divider py={'10px'} borderColor={'gray.300'} />
      <SubredditSearch
        value={searchedSubreddit}
        onChange={setSearchedSubreddit}
        py={'5'}
        px={'2.5'}
      />
      {sliders}
    </Box >
  );
};

SubredditConfigMenu.propType = {
  subredditData: PropTypes.array,
  onSubredditFrequencyChange: PropTypes.func,
};

export default SubredditConfigMenu;
