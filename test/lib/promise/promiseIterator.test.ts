import { range, promiseIterator as iterator, emptyPromiseIterator as empty, toPromise } from '../../../src/lib/promise';
import {
  asyncAlwaysFalse,
  asyncAlwaysTrue,
  defaultComparator,
  lengthComparator,
  handleCollisionIgnore,
} from '../../../src/lib/functions';
import { FlattenCollector } from '../../../src/lib/collectors';
import { expect, assert } from 'chai';

describe('PromiseIterator', () => {
  describe('collect', () => {
    it('should collect all elements', async () => {
      expect(await iterator(toPromise([1, 2])).collect()).to.deep.equal([1, 2]);
    });
    it('should return empty array on empty iterator', async () => {
      expect(await empty().collect()).to.deep.equal([]);
    });
  });

  describe('allSettled', () => {
    it('should wait for all elements', async () => {
      expect(await iterator(range(1, 3)).allSettled()).to.deep.equal([
        { status: 'fulfilled', value: 1 },
        { status: 'fulfilled', value: 2 },
      ]);
    });
    it('should return errors', async () => {
      expect(
        await iterator([Promise.resolve(1), Promise.resolve(2), Promise.reject('foobar')]).allSettled()
      ).to.deep.equal([
        { status: 'fulfilled', value: 1 },
        { status: 'fulfilled', value: 2 },
        { status: 'rejected', reason: 'foobar' },
      ]);
    });
    it('should return empty array on empty iterator', async () => {
      expect(await empty().allSettled()).to.deep.equal([]);
    });
  });

  describe('any', () => {
    it('should collect first promise resolved', async () => {
      expect(await iterator([Promise.reject(), Promise.reject(), Promise.resolve(1)]).any()).to.equal(1);
    });
    it('should return undefined on empty iterator', async () => {
      expect(await empty().any()).to.be.undefined;
    });
    it('should return matching element if exists', async () => {
      expect(await iterator(range(1, 7)).first(x => x % 3 === 0)).to.equal(3);
    });
    it('should return if no matching element', async () => {
      expect(await iterator(range(1, 5)).first(x => x >= 5)).to.be.undefined;
    });
  });

  describe('race', () => {
    it('should collect first promise', async () => {
      expect(await iterator(range(1, 10)).race()).to.equal(1);
    });
    it('should throw', async () => {
      try {
        await iterator([Promise.reject(), Promise.resolve(1)]).race();
      } catch (err) {
        return;
      }
      assert.fail('race should have trown');
    });
    it('should return undefined on empty iterator', async () => {
      expect(await empty().race()).to.be.undefined;
    });
  });

  describe('map', () => {
    it('should apply function to all elements', async () => {
      expect(
        await iterator(range(1, 3))
          .map(x => 2 * x)
          .collect()
      ).to.deep.equal([2, 4]);
    });
  });

  describe('flatmap', () => {
    it('should apply function to all elements', async () => {
      expect(
        await iterator(range(1, 3))
          .flatmap(async x => 2 * (await x))
          .collect()
      ).to.deep.equal([2, 4]);
    });
  });

  describe('first', () => {
    it('should return the first element', async () => {
      expect(await iterator(range(1, 100)).first()).to.equal(1);
    });

    it('should return undefined on empty iterator.', async () => {
      expect(await empty().first()).to.be.undefined;
    });
  });

  describe('take', () => {
    it('should yield no elements if 0 is passed', async () => {
      expect(await iterator(range(0, 100)).take(0).collect()).to.deep.equal([]);
    });
    it('should yield the exact number of elements more elements than required', async () => {
      expect(await iterator(range(0, 100)).take(2).collect()).to.deep.equal([0, 1]);
    });
    it('should yield all elements if there are less elements than required', async () => {
      expect(await iterator(range(0, 2)).take(1000).collect()).to.deep.equal([0, 1]);
    });
  });

  describe('skip', () => {
    it('should skip the exact number of elements if skip equals he number of elements', async () => {
      expect(await iterator(range(1, 3)).skip(2).collect()).to.deep.equal([]);
    });
    it('should skip the exact number of elements if skip is less than the number of elements', async () => {
      expect(await iterator(range(1, 3)).skip(1).collect()).to.deep.equal([2]);
    });
    it('should skip all elements if skip is greater than the number of elements', async () => {
      expect(await iterator(range(1, 3)).skip(3).collect()).to.deep.equal([]);
    });
    it('should skip no elements if skip is 0', async () => {
      expect(await iterator(range(1, 3)).skip(0).collect()).to.deep.equal([1, 2]);
    });
  });

  describe('filter', () => {
    it('should filter odd elements', async () => {
      expect(
        await iterator(range(1, 3))
          .filter(x => x % 2 === 0)
          .collect()
      ).deep.equal([2]);
    });
    it('should filter odd elements with promise predicate', async () => {
      expect(
        await iterator(range(1, 3))
          .filter(x => Promise.resolve(x % 2 === 0))
          .collect()
      ).deep.equal([2]);
    });
  });

  describe('zip', () => {
    it('should zip up to shortest iterator with PromiseIterator', async () => {
      expect(
        await iterator(range(1, 4))
          .zip(iterator(range(1, 3)))
          .collect()
      ).to.deep.equal([
        [1, 1],
        [2, 2],
      ]);
    });
    it('should zip up to shortest iterator with Iterable', async () => {
      expect(
        await iterator(range(1, 4))
          .zip(toPromise([1, 2]))
          .collect()
      ).to.deep.equal([
        [1, 1],
        [2, 2],
      ]);
    });
  });

  describe('enumerate', () => {
    it('should enumerate all elements', async () => {
      expect(await iterator(range(1, 3)).enumerate().collect()).to.deep.equal([
        [1, 0],
        [2, 1],
      ]);
    });
    it('should enumerate all elements with start value', async () => {
      expect(await iterator(range(1, 3)).enumerate(10).collect()).to.deep.equal([
        [1, 10],
        [2, 11],
      ]);
    });
  });

  describe('contains', () => {
    it('should return true', async () => {
      expect(await iterator(range(1, 7)).contains(x => x % 3 === 0)).equal(true);
    });
    it('should return false', async () => {
      expect(await iterator(range(1, 5)).contains(x => x >= 5)).equal(false);
    });
    it('should return true with promise', async () => {
      expect(await iterator(range(1, 7)).contains(x => Promise.resolve(x % 3 === 0))).equal(true);
    });
    it('should return false with promise', async () => {
      expect(await iterator(range(1, 5)).contains(x => Promise.resolve(x >= 5))).equal(false);
    });
  });

  describe('includes', () => {
    it('should return true', async () => {
      expect(await iterator(range(1, 7)).includes(3)).equal(true);
    });
    it('should return false', async () => {
      expect(await iterator(range(1, 5)).includes(6)).equal(false);
    });
    it('should return true with promise', async () => {
      expect(await iterator(range(1, 7)).includes(Promise.resolve(3))).equal(true);
    });
    it('should return false with promise', async () => {
      expect(await iterator(range(1, 5)).includes(Promise.resolve(6))).equal(false);
    });
  });

  describe('fold', () => {
    it('should add all elements to initial value', async () => {
      expect(await iterator(range(1, 5)).fold((acc, x) => acc + x, 10)).to.equal(20);
    });
  });

  describe('reduce', () => {
    it('should add all elements to initial value', async () => {
      expect(await iterator(range(1, 5)).reduce((acc, x) => acc + x, 10)).to.equal(20);
    });
    it('should add all elements', async () => {
      expect(await iterator(range(1, 5)).reduce((acc, x) => acc + x)).to.equal(10);
    });
  });

  describe('tap', () => {
    it('should tap all elements', async () => {
      let count = 0;
      let f = (x: number) => {
        count += x;
      };
      expect(await iterator(range(1, 5)).tap(f).collect()).to.deep.equal([1, 2, 3, 4]);
      expect(count).equal(10);
    });
  });

  describe('forEach', () => {
    it('should invoke function for all elements', async () => {
      let count = 0;
      let f = (x: number) => {
        count += x;
      };
      await iterator(range(1, 5)).forEach(f);
      expect(count).equal(10);
    });
  });

  describe('append', () => {
    it('should append multiple elements', async () => {
      expect(await iterator(range(1, 3)).append(range(3, 5)).collect()).to.deep.equal([1, 2, 3, 4]);
    });

    it('should append to empty iterator', async () => {
      expect(await empty<number>().append(range(1, 3)).collect()).to.deep.equal([1, 2]);
    });
    it('should append an empty array', async () => {
      expect(await iterator(range(1, 3)).append([]).collect()).to.deep.equal([1, 2]);
    });
  });

  describe('prepend', () => {
    it('should prepend multiple elements', async () => {
      expect(await iterator(range(1, 2)).prepend(range(2, 4)).collect()).to.deep.equal([2, 3, 1]);
    });

    it('should prepend to empty iterator', async () => {
      expect(await empty<number>().prepend(range(1, 3)).collect()).to.deep.equal([1, 2]);
    });
    it('should prepend an empty array', async () => {
      expect(await iterator(range(1, 3)).prepend([]).collect()).to.deep.equal([1, 2]);
    });
  });

  describe('concat', () => {
    it('should concat multiple elements', async () => {
      expect(
        await iterator(range(1, 2))
          .concat([Promise.resolve(2)], [Promise.resolve(3)])
          .collect()
      ).to.deep.equal([1, 2, 3]);
    });

    it('should concat to empty iterator', async () => {
      expect(await empty<number>().concat(range(1, 3)).collect()).to.deep.equal([1, 2]);
    });
    it('should concat an empty array', async () => {
      expect(await iterator(range(1, 3)).concat([]).collect()).to.deep.equal([1, 2]);
    });
    it('should concat argument-less', async () => {
      expect(await iterator(range(1, 3)).concat().collect()).to.deep.equal([1, 2]);
    });
  });

  describe('takeWhile', () => {
    it('take up to 5', async () => {
      expect(
        await iterator(range(1, 100))
          .takeWhile(x => Promise.resolve(x <= 2))
          .collect()
      ).to.deep.equal([1, 2]);
    });
    it('should return all elements', async () => {
      expect(await iterator(range(1, 4)).takeWhile(asyncAlwaysTrue).collect()).to.deep.equal([1, 2, 3]);
    });
    it('should return no elements', async () => {
      expect(await iterator(range(1, 4)).takeWhile(asyncAlwaysFalse).collect()).to.deep.equal([]);
    });
    it('should work on empty iterator', async () => {
      expect(
        await empty()
          .takeWhile(x => {
            throw new Error(`x = ${x}`);
          })
          .collect()
      ).to.deep.equal([]);
    });
  });

  describe('skipWhile', () => {
    it('should yield skip 2 elements', async () => {
      expect(
        await iterator(toPromise([1, 10, 2, 11]))
          .skipWhile(x => Promise.resolve(x != 10))
          .collect()
      ).to.deep.equal([10, 2, 11]);
    });
    it('should return no elements', async () => {
      expect(
        await iterator(range(1, 4))
          .skipWhile(x => Promise.resolve(x > 0))
          .collect()
      ).to.deep.equal([]);
    });
    it('should return all elements', async () => {
      expect(
        await iterator(range(1, 4))
          .skipWhile(x => x % 2 === 0)
          .collect()
      ).to.deep.equal([1, 2, 3]);
    });
    it('should work on empty iterator', async () => {
      expect(
        await empty()
          .skipWhile(x => {
            throw new Error(`x = ${x}`);
          })
          .collect()
      ).to.deep.equal([]);
    });
  });

  describe('distinct', () => {
    it('should eliminate duplicates', async () => {
      expect(
        await iterator(toPromise([1, 2, 5, 2, 1, 0]))
          .distinct()
          .collect()
      ).deep.equal([1, 2, 5, 0]);
    });
    it('should only yield one odd and one even number', async () => {
      expect(
        await iterator(toPromise([1, 2, 5, 2, 1, 0]))
          .distinct(x => x % 2)
          .collect()
      ).deep.equal([1, 2]);
    });
  });

  describe('all', () => {
    it('should return true', async () => {
      expect(await iterator(range(1, 5)).all(x => x > 0)).equal(true);
    });
    it('should return true if empty', async () => {
      expect(await iterator(range(0, 0)).all(x => x > 0)).equal(true);
    });
    it('should return false', async () => {
      expect(await iterator(range(4, -1)).all(x => x > 0)).equal(false);
    });
  });

  describe('some', () => {
    it('should return true', async () => {
      expect(await iterator(range(-1, 2)).some(x => x > 0)).equal(true);
    });
    it('should return false if empty', async () => {
      expect(await iterator(range(0, 0)).some(x => x > 0)).equal(false);
    });
    it('should return false', async () => {
      expect(await iterator(range(-5, 1)).some(x => x > 0)).equal(false);
    });
  });

  describe('sum', () => {
    it('should apply mapper', async () => {
      expect(await iterator(toPromise(['foo', 'bar', 'foobar'])).sum(x => x.length)).equal(12);
    });
    it('should sum numbers', async () => {
      expect(await iterator(toPromise([1, 2, 3])).sum()).equal(6);
    });
    it('should return 0 on empty iterators', async () => {
      expect(await empty().sum()).equal(0);
    });
  });

  describe('avg', () => {
    it('should apply mapper', async () => {
      expect(await iterator(toPromise(['foo', 'bar', 'foobar'])).avg(x => x.length)).equal(4);
    });
    it('should avg numbers', async () => {
      expect(await iterator(toPromise([1, 2])).avg()).equal(1.5);
    });
    it('should return 0 on empty iterators', async () => {
      expect(await empty().avg()).equal(0);
    });
  });

  describe('min', () => {
    it('should return the shortest string', async () => {
      expect(
        await iterator(toPromise(['foo', 'bar', 'x', 'foobar'])).min((a, b) => defaultComparator(a.length, b.length))
      ).equal('x');
    });
    it('should return lexicographically smallest string', async () => {
      expect(await iterator(toPromise(['foo', 'bar', 'x', 'foobar'])).min()).equal('bar');
    });
  });

  describe('max', () => {
    it('should return the longest string', async () => {
      expect(
        await iterator(toPromise(['foo', 'bar', 'x', 'foobar'])).max((a, b) => defaultComparator(a.length, b.length))
      ).equal('foobar');
    });
    it('should return lexicographically largest string', async () => {
      expect(await iterator(toPromise(['foo', 'bar', 'x', 'foobar'])).max()).equal('x');
    });
  });

  describe('minmax', () => {
    it('should return the longest and shortest strings', async () => {
      expect(await iterator(toPromise(['foo', 'bar', 'x', 'foobar'])).minmax(lengthComparator)).deep.equal({
        min: 'x',
        max: 'foobar',
      });
    });
    it('should return lexicographically smallest and largest strings', async () => {
      expect(await iterator(toPromise(['foo', 'bar', 'x', 'foobar'])).minmax()).deep.equal({ min: 'bar', max: 'x' });
    });
  });

  describe('last', () => {
    it('should return the last string', async () => {
      expect(await iterator(toPromise(['foo', 'bar', 'x', 'foobar'])).last()).equal('foobar');
    });
    it('should return the last string of length 3', async () => {
      expect(await iterator(toPromise(['foo', 'bar', 'x', 'foobar'])).last(s => s.length === 3)).equal('bar');
    });
    it('should return undefined', async () => {
      expect(await iterator(toPromise(['foo', 'bar', 'x', 'foobar'])).last(s => s.length > 10)).to.be.undefined;
    });
  });

  describe('count', () => {
    it('should use predicate', async () => {
      expect(await iterator(range(1, 4)).count(x => x % 2 === 0)).equal(1);
    });
    it('should use default true predicate', async () => {
      expect(await iterator(range(1, 4)).count()).equal(3);
    });
  });

  describe('join', () => {
    it('should use separator', async () => {
      expect(await iterator(toPromise([1, 2, 3])).join('-')).equal('1-2-3');
    });
    it('should use default separator', async () => {
      expect(await iterator(toPromise([1, 2, 3])).join()).equal('1,2,3');
    });
    it('should return empty string', async () => {
      expect(await iterator(toPromise([])).join()).equal('');
    });
    it('should use prefix and suffix', async () => {
      expect(await iterator(toPromise([1, 2, 3])).join(',', '[', ']')).equal('[1,2,3]');
    });
    it('should use prefix and suffix', async () => {
      expect(await iterator(toPromise([])).join(',', '[', ']')).equal('[]');
    });
  });

  describe('groupBy', () => {
    it('should group numbers according to their last bit', async () => {
      const actual = await iterator(toPromise([2, 5, 4, 3, 1])).groupBy(x => x % 2);
      const expected = new Map().set(0, [2, 4]).set(1, [5, 3, 1]);
      expect(actual).deep.equal(expected);
    });
  });

  describe('collectToMap', () => {
    it('should return the last even and odd number', async () => {
      const actual = await iterator(toPromise([2, 5, 4, 3, 1])).collectToMap(x => [x % 2, x]);
      const expected = new Map().set(0, 4).set(1, 1);
      expect(actual).deep.equal(expected);
    });
    it('should return the first even and odd number', async () => {
      const actual = await iterator(toPromise([2, 5, 4, 3, 1])).collectToMap(x => [x % 2, x], handleCollisionIgnore);
      const expected = new Map().set(0, 2).set(1, 5);
      expect(actual).deep.equal(expected);
    });
  });

  describe('collectToObject', () => {
    interface Data {
      key: string;
      value: number;
    }

    function mapper(data: Data): [string, number] {
      return [data.key, data.value];
    }

    it('should return the last occurences of key', async () => {
      const actual = await iterator(
        toPromise([
          { key: 'a', value: 1 },
          { key: 'a', value: 2 },
          { key: 'b', value: 3 },
          { key: 'b', value: 4 },
        ])
      ).collectToObject(mapper);
      const expected = { a: 2, b: 4 };
      expect(actual).deep.equal(expected);
    });
    it('should return the first occurences of key', async () => {
      const actual = await iterator(
        toPromise([
          { key: 'a', value: 1 },
          { key: 'a', value: 2 },
          { key: 'b', value: 3 },
          { key: 'b', value: 4 },
        ])
      ).collectToObject(mapper, handleCollisionIgnore);
      const expected = { a: 1, b: 3 };
      expect(actual).deep.equal(expected);
    });
  });

  describe('collectTo with FlattenCollector', () => {
    it('should return flattened list of numbers', async () => {
      const actual = (
        await iterator(
          toPromise([
            [2, 5],
            [4, 2, 5],
          ])
        ).collectTo(new FlattenCollector())
      ).collect();
      const expected = [2, 5, 4, 2, 5];
      expect(actual).deep.equal(expected);
    });
    it('should return flattened set of numbers', async () => {
      const actual = (
        await iterator(
          toPromise([
            [2, 5],
            [4, 2, 5],
          ])
        ).collectTo(new FlattenCollector())
      ).collectToSet();
      const expected = new Set([2, 4, 5]);
      expect(actual).deep.equal(expected);
    });
  });

  describe('collectToSet', () => {
    it('should return set of numbers', async () => {
      const actual = await iterator(toPromise([2, 5, 4, 2, 5])).collectToSet();
      const expected = new Set([2, 4, 5]);
      expect(actual).deep.equal(expected);
    });
  });

  describe('tally', () => {
    it('should count event and odd numbers', async () => {
      const actual = await iterator(toPromise([2, 5, 4, 3, 1])).tally(x => x % 2);
      const expected = new Map().set(0, 2).set(1, 3);
      expect(actual).deep.equal(expected);
    });
    it('should count all words', async () => {
      const actual = await iterator(toPromise(['foo', 'bar', 'foobar', 'foo'])).tally();
      const expected = new Map().set('foo', 2).set('bar', 1).set('foobar', 1);
      expect(actual).deep.equal(expected);
    });
  });

  describe('partition', () => {
    it('should split iterator based on partition size', async () => {
      const actual = await Promise.all(
        iterator(toPromise([2, 5, 4, 3, 1]))
          .partition(2)
          .map(x => Promise.all(x))
          .collect()
      );
      const expected = [[2, 5], [4, 3], [1]];
      expect(actual).deep.equal(expected);
    });
  });

  describe('Symbol', () => {
    it('should be usable as a native async iterator', async () => {
      const expected = [1, 2];
      const iter = iterator(toPromise(expected));
      const actual = [];
      for (const c of iter) {
        actual.push(await c);
      }
      expect(actual).to.deep.equal(expected);
    });
  });
});
