import React from "react";
import PropTypes from 'prop-types';
import {
  Icon,
  Input,
  InputGroup,
  InputGroupProps,
  InputRightElement,
} from "@chakra-ui/react";
import { MdClear } from 'react-icons/md'
import { useState } from "react";

interface SubredditSearchProps extends Omit<InputGroupProps, 'onChange'> {
  value?: string;
  onChange?: (newSearchString: string) => void;
}

const SubredditSearch = (props: SubredditSearchProps) => {
  const { value, onChange, ...inputGroupProps } = props;

  const [isClearable, setIsClearable] = useState<boolean>(false);

  const onValueChange = (newValue: string): void => {
    setIsClearable(Boolean(newValue));
    onChange?.(newValue);
  };

  const clearButton: JSX.Element = (
    <Icon
      as={MdClear}
      onClick={() => onValueChange('')}
      w={'2em'}
      h={'2em'}
      p={'5px'}
      color={'gray.500'}
      borderRadius={'100%'}
      transition={'all 0.075s linear'}
      _hover={{ backgroundColor: 'gray.100' }}
    />
  )

  return (
    <InputGroup {...inputGroupProps}>
      <Input
        value={value}
        autoFocus
        placeholder="Search subreddit..."
        size="md"
        variant="flushed"
        onChange={(event) => onValueChange(event.target.value)}
      />
      <InputRightElement top={'unset'}>
        {isClearable ? clearButton : null}
      </InputRightElement>
    </InputGroup>
  );
};

SubredditSearch.propType = {
  value: PropTypes.string,
  onChange: PropTypes.func,
};

export default SubredditSearch;
