import React from "react";
import { Box, BoxProps, Button, Flex, Icon, Text, TextProps } from "@chakra-ui/react";

import { BsArrowLeft } from "react-icons/bs";

const StyledText = (textProps: TextProps) => (
  <Text
    {...textProps}
    p={'1'}
  />
);

const NoSubredditsFoundMessage = (props: BoxProps) => {
  const { ...boxProps } = props;

  const onArrowClick = () => window.close();

  return (
    <Box {...boxProps} fontSize={'sm'}>
      <StyledText>
        Looks like we haven't found any of your subreddits yet ¯\_(ツ)_/¯
      </StyledText>

      <StyledText>
        This plugin uses the list of subreddits you're subscribed to.
      </StyledText>

      <StyledText>
        Open the menu with your subreddits to load them
      </StyledText>

      <Flex justify='center' pt='10px'>
        <Button variant="ghost" size='sm' onClick={onArrowClick}>
          <Icon as={BsArrowLeft} boxSize='2em' pr='5px' w='100%' focusable={true} />
          Go open subreddits menu
        </Button>
      </Flex>
    </Box>
  );
};

export default NoSubredditsFoundMessage;
