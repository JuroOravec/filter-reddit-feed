import React from "react";
import PropTypes from 'prop-types';
import { Box, BoxProps, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Text } from "@chakra-ui/react";

import type { SubredditFeed } from "../models/subredditFeed";
import type { Subreddit } from "../models/subreddit";

export interface SubredditSliderProps extends Omit<BoxProps, 'onChange'> {
  subreddit: Subreddit;
  subredditFeed: SubredditFeed;
  onChange?: (newValue: number) => void;
}

const SubredditSlider = (props: SubredditSliderProps) => {
  const { subreddit, subredditFeed, onChange, ...boxProps } = props;

  return (
    <Box {...boxProps}>
      <Text fontWeight={'bold'} fontSize={'sm'}>
        {subreddit.subredditName}
      </Text>
      <Slider
        defaultValue={subredditFeed.config.frequency}
        name={subreddit.subredditName}
        min={0.01}
        max={1}
        step={0.01}
        focusThumbOnChange={false}
        onChange={onChange}
      >
        <SliderTrack
          h={'5px'}
        >
          <SliderFilledTrack />
        </SliderTrack>
        <SliderThumb borderColor={'gray.300'} />
      </Slider>
    </Box>
  );
};

SubredditSlider.propType = {
  subreddit: PropTypes.object.isRequired,
  subredditFeed: PropTypes.object.isRequired,
  onChange: PropTypes.func,
};

export default SubredditSlider;
