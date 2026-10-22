import { fireEvent, render, screen } from '@testing-library/react';
import { Stepper } from './Stepper';

function setup(over: Partial<Parameters<typeof Stepper>[0]> = {}) {
  const onDecrease = vi.fn();
  const onIncrease = vi.fn();
  render(
    <Stepper
      value={3}
      decreaseLabel="Decrease Coffee"
      increaseLabel="Increase Coffee"
      countLabel="Coffee count"
      canDecrease
      canIncrease
      onDecrease={onDecrease}
      onIncrease={onIncrease}
      {...over}
    />,
  );
  return { onDecrease, onIncrease };
}

describe('Stepper', () => {
  it('names the buttons and the count', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Decrease Coffee' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Increase Coffee' })).toBeEnabled();
    expect(screen.getByLabelText('Coffee count')).toHaveTextContent('3');
  });

  it('calls the handlers on click', () => {
    const { onDecrease, onIncrease } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Coffee' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Coffee' }));
    expect(onDecrease).toHaveBeenCalledTimes(1);
    expect(onIncrease).toHaveBeenCalledTimes(1);
  });

  it('disables + when canIncrease is false and ignores clicks', () => {
    const { onIncrease } = setup({ canIncrease: false });
    const plus = screen.getByRole('button', { name: 'Increase Coffee' });
    expect(plus).toBeDisabled();
    fireEvent.click(plus);
    expect(onIncrease).not.toHaveBeenCalled();
  });

  it('disables - when canDecrease is false', () => {
    const { onDecrease } = setup({ canDecrease: false });
    const minus = screen.getByRole('button', { name: 'Decrease Coffee' });
    expect(minus).toBeDisabled();
    fireEvent.click(minus);
    expect(onDecrease).not.toHaveBeenCalled();
  });
});
