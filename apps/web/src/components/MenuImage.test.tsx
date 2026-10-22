import { fireEvent, render, screen } from '@testing-library/react';
import { FALLBACK_MENU_IMAGE } from '../features/menu/menu-images';
import { MenuImage } from './MenuImage';

describe('MenuImage', () => {
  it('shows the photo lazily and swaps to the fallback on error', () => {
    render(<MenuImage code="COFFEE" alt="Coffee" />);
    const img = screen.getByRole('img', { name: 'Coffee' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img.getAttribute('src')).toMatch(/coffee\.jpg$/);
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', FALLBACK_MENU_IMAGE);
  });
});
